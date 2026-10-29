import { createHash } from "node:crypto";
import { z } from "zod";

const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const id = z.number().int().positive().safe();
const text = z.string().trim().min(1).max(4000);

/** Fatos do edital e instruções autorais internas são evidências distintas. */
export const scopedQuestionProfileSchema = z.object({
  version: z.string().trim().min(3).max(120),
  format: z.enum(["multiple_choice", "true_false"]),
  commandStyle: text, reasoningDemand: text,
  authoringGuidelines: z.array(text).min(1).max(20),
  distractorGuidance: z.array(text).min(1).max(20),
  prohibitedPatterns: z.array(text).min(1).max(20),
  disclaimer: z.string().trim().min(20).max(500),
}).strict();

const officialQuestionContractBaseSchema = z.object({
  schemaVersion: z.literal(1), opportunityId: id, examEditionId: id,
  bankId: id, organizerAssignmentId: id,
  roleName: text, specializationId: id.nullable(), cycleYear: z.number().int().min(1900).max(2200),
  noticeNumber: text, stageKey: z.literal("objective"),
  // A preparação de várias especialidades exige trilhas próprias, em outra fase.
  scope: z.literal("single_role"),
  sourceDocumentId: id, sourceSnapshotId: id, sourceSnapshotChecksum: hash,
  sourceDocumentUrl:z.url(),sourceDocumentChecksum:hash.nullable(),
  sourceUrl: z.url().refine(value => { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && !u.port; }),
  sourcePage: z.number().int().min(1).max(250), sourceLocator: text,
  sourceQuote: z.string().trim().min(40).max(12000),
  identityPage:z.number().int().min(1).max(250), identityQuote:z.string().trim().min(40).max(12000),
  format: z.enum(["multiple_choice", "true_false"]),
  optionKeys: z.array(z.enum(["A", "B", "C", "D", "E"])).min(2).max(5),
  officialAnswerKeys:z.array(z.enum(["A","B","C","D","E"])).min(2).max(5),
  profile: scopedQuestionProfileSchema,
}).strict();

function refineContract(value: z.infer<typeof officialQuestionContractBaseSchema>, ctx: z.RefinementCtx) {
  const expected = value.format === "true_false" ? ["A", "B"] : ["A", "B", "C", "D", "E"];
  if (JSON.stringify(value.optionKeys) !== JSON.stringify(expected) || value.profile.format !== value.format) {
    ctx.addIssue({ code: "custom", message: "Formato, chaves e perfil interno devem corresponder ao contrato exato." });
  }
  const official=value.format==='true_false'?['C','E']:expected;
  if(JSON.stringify(value.officialAnswerKeys)!==JSON.stringify(official))ctx.addIssue({code:'custom',message:'Os códigos oficiais diferem da codificação interna A/B do treino C/E.'});
}

export const mprjFormatEvidenceSchema = z.object({
  evidenceId: hash, documentPublicId: z.uuid(), sourceUrl: z.literal("https://conhecimento.fgv.br/sites/default/files/concursos/promotor-de-justica-substituto-cns001-tipo-1.pdf"),
  sourceSha256: hash, robotsSha256: hash, pageTextSha256: hash, pageNumber: z.literal(1),
  parserVersion: z.literal("mprj-type1-cover-mc5-v1"), format: z.literal("multiple_choice"),
  optionCount: z.literal(5), singleCorrect: z.literal(true), questionCount: z.literal(100),
  verificationDate: z.iso.date(),
}).strict();
// Derive strict objects BEFORE adding refinements: Zod4 forbids omit() after superRefine().
export const officialQuestionContractInputSchema = officialQuestionContractBaseSchema.superRefine(refineContract);
export const officialQuestionContractSchema = officialQuestionContractBaseSchema
  .extend({ formatEvidence: mprjFormatEvidenceSchema.optional() }).strict().superRefine((value, ctx) => {
    refineContract(value, ctx);
    if (value.formatEvidence && (value.opportunityId !== 20 || value.examEditionId !== 41 ||
      value.roleName !== "Promotor de Justiça Substituto" || value.noticeNumber !== "XXXIX/2026" ||
      value.cycleYear !== 2026 || value.specializationId !== null || value.format !== "multiple_choice")) {
      ctx.addIssue({ code: "custom", message: "Evidência MC5 fora do escopo MPRJ autorizado." });
    }
  });
export type OfficialQuestionContract = z.infer<typeof officialQuestionContractSchema>;

/** Verificação delimitada da cláusula de formato; ausência/ambiguidade exige nova análise. */
export function officialFormatEvidenceMatches(format:OfficialQuestionContract['format'],quote:string) {
  const text=quote.normalize('NFKD').replace(/\p{M}/gu,'').replace(/\s+/gu,' ').toLowerCase();
  const mc=/(?:5|cinco)\s*(?:\(cinco\))?\s*(?:alternativas|opcoes)/u.test(text);
  const ce=/\bcerto\b/u.test(text)&&/\berrado\b/u.test(text)&&/julgamento|julgue|julgad[oa]/u.test(text);
  const coverClause=/questoes objetivas tem 5\s*\(cinco\) opcoes de resposta \(a, b, c, d e e\) e somente uma delas esta correta/u.exec(text);
  const coverClauseNegated=coverClause && /\b(?:nao|falso|incorreto)\b[^.!?]*$/u.test(text.slice(Math.max(0,coverClause.index-80),coverClause.index));
  const single=(!!coverClause && !coverClauseNegated) || /apenas uma resposta correta|uma unica resposta|um,? e somente um|das quais apenas 1\s*\(uma\) sera correta|com somente uma opcao correta/u.test(text);
  return format==='multiple_choice'?mc&&single&&!ce:ce&&!mc;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export function questionContractFingerprint(input: unknown) {
  return createHash("sha256").update(JSON.stringify(canonical(officialQuestionContractSchema.parse(input)))).digest("hex");
}

export function validateQuestionAgainstContract(contractInput: unknown, question: {
  type: string; options: readonly { key: string; text: string; correct: boolean }[];
}) {
  const parsed = officialQuestionContractSchema.safeParse(contractInput);
  if (!parsed.success) return { allowed: false as const, reason: "Contrato oficial de cargo, edição e etapa ausente ou inválido." };
  const contract = parsed.data;
  const normalized = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLowerCase();
  if (question.type !== contract.format || question.options.length !== contract.optionKeys.length ||
    question.options.some((option, i) => option.key !== contract.optionKeys[i] || !normalized(option.text)) ||
    question.options.filter(option => option.correct).length !== 1 ||
    new Set(question.options.map(option => normalized(option.text))).size !== contract.optionKeys.length) {
    return { allowed: false as const, reason: "Questão incompatível com o formato oficial deste cargo, edição e etapa." };
  }
  if(contract.format==='true_false' && question.options.map(option=>normalized(option.text)).join(',')!=='certo,errado') {
    return {allowed:false as const,reason:'Certo/errado exige rótulos padronizados e codificação interna A/B explícita.'};
  }
  return { allowed: true as const, reason: null };
}

/** Perfil novo de MC5 para o cargo; não substitui o C/E global do Cebraspe. */
export const PC_MA_DELEGADO_MULTIPLE_CHOICE_PROFILE = scopedQuestionProfileSchema.parse({
  version: "pc-ma-delegado-objective-mc5-v1", format: "multiple_choice",
  commandStyle: "Caso ou comando autônomo com cinco alternativas A a E e uma única resposta correta.",
  reasoningDemand: "Aplicação precisa da norma oficial aos fatos necessários para o cargo de Delegado de Polícia.",
  authoringGuidelines: ["Crie um caso inteiramente novo a partir da fonte legal fornecida.", "Delimite uma única decisão jurídica verificável no dispositivo oficial.", "Use cinco alternativas paralelas, sem pistas gramaticais ou dependência de outra questão."],
  distractorGuidance: ["Altere requisito, competência, prazo ou consequência legal em cada distrator.", "Explique a incorreção de cada alternativa com o artigo oficial, sem doutrina presumida."],
  prohibitedPatterns: ["Não consultar, copiar, resumir ou parafrasear questões de provas ou simulados.", "Não transformar um item de certo/errado existente em questão de cinco opções.", "Não atribuir a autoria ou o perfil interno à banca examinadora."],
  disclaimer: "Perfil editorial interno e abstrato do cargo, para autoria inédita. O formato é documentado no edital; estas instruções não são material oficial da banca e não derivam de questões de terceiros.",
});

/** Perfil abstrato interno exclusivo do cargo; somente o formato é comprovado pela capa. */
export const MPRJ_PROMOTOR_MULTIPLE_CHOICE_PROFILE = scopedQuestionProfileSchema.parse({
  version: "mprj-promotor-xxxix-objective-mc5-v1", format: "multiple_choice",
  commandStyle: "Comando autônomo com cinco alternativas A a E e uma única resposta correta.",
  reasoningDemand: "Aplicação da norma oficial ao programa vigente do cargo de Promotor de Justiça Substituto do MPRJ, sem atribuir demanda cognitiva inferida à banca.",
  authoringGuidelines: ["Crie item inteiramente inédito a partir das fontes legais oficiais fornecidas.", "Delimite uma única decisão jurídica verificável na norma oficial.", "Use somente o programa deste cargo, edição e etapa, sem transferir perfis de outros cargos."],
  distractorGuidance: ["Altere requisito, competência, prazo ou consequência legal em alternativas paralelas.", "Explique cada distrator com dispositivo oficial, sem doutrina presumida."],
  prohibitedPatterns: ["Não consultar, copiar, resumir ou parafrasear questões ou alternativas de provas e simulados.", "Não usar o caderno da banca como corpus ou atribuir estas orientações internas à FGV.", "Não transferir perfil de outro cargo ou etapa."],
  disclaimer: "Perfil editorial interno e abstrato para autoria inédita. A capa comprova somente o formato MC5; estas orientações não são material oficial nem derivam de questões da banca.",
});
