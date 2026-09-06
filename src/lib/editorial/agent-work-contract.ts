import { createHash } from "node:crypto";
import { z } from "zod";
import { parseOfficialOpportunitySourceUrl } from "@/lib/opportunities/source-monitor-policy";
import { discoveryPathBlocked } from "./discovery-policy";

export const AGENT_WORK_VERSION = "editalume-agents-v1";
export const AGENT_WORK_LEASE_MINUTES = 45;
export const AGENT_WORK_DAILY_LIMIT = 24;
export const agentWorkKindSchema = z.enum(["discovery", "legal_mapping", "authoring", "legal_change"]);
export type AgentWorkKind = z.infer<typeof agentWorkKindSchema>;
export const AGENT_FOR_WORK: Record<AgentWorkKind, string> = {
  discovery: "Radar", legal_mapping: "Guardião", authoring: "Autor", legal_change: "Guardião",
};
const boundedText = z.string().trim().min(1).max(8_000);
const publicHttps = z.url().max(2_000).refine(value=>{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port;},"A fonte exige HTTPS sem credenciais.");
const evidenceSchema = z.object({ url: publicHttps, locator: boundedText }).strict();
export const workArticleSchema = z.object({
  id: z.number().int().positive(), act: boundedText, articleRef: boundedText,
  versionId: z.number().int().positive(), checksum: z.string().regex(/^[a-f0-9]{64}$/),
  text: z.string().min(20).max(80_000), url: publicHttps,
}).strict();
export type WorkArticle = z.infer<typeof workArticleSchema>;
export const workPayloadSchema = z.object({
  version: z.literal(AGENT_WORK_VERSION), title: boundedText,
  instructions: boundedText, context: z.record(z.string(), z.unknown()),
  articles: z.array(workArticleSchema).max(20),
  sourceUrls: z.array(publicHttps).max(30),
  requirementId: z.number().int().positive().optional(),
  opportunityId: z.number().int().positive().optional(),
  bank: z.enum(["fgv", "fcc", "vunesp", "cebraspe"]).optional(),
  role: boundedText.optional(),
  parentKey: z.string().max(220).optional(),
  parentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();
export type AgentWorkPayload = z.infer<typeof workPayloadSchema>;
export const agentWorkResultSchema = z.object({
  schemaVersion: z.literal(1), publicationAllowed: z.literal(false),
  outcome: z.enum(["prepared", "blocked"]), summary: boundedText,
  limitations: z.array(boundedText).max(20), evidence: z.array(evidenceSchema).max(30),
  generatorModel: z.string().trim().min(2).max(120).optional(),
  mappings: z.array(z.object({ articleId: z.number().int().positive(),
    rationale: boundedText, quote: boundedText }).strict()).max(8).default([]),
  discoveries: z.array(z.object({ title: boundedText, url: publicHttps,
    kind: z.enum(["notice", "rectification", "announcement"]),
    role: boundedText, bank: boundedText.nullable(), jurisdiction: boundedText,
    observedAt: z.iso.datetime(), evidence: boundedText }).strict()).max(20).default([]),
  questions: z.array(z.object({
    prompt: z.string().trim().min(40).max(4_000), articleId: z.number().int().positive(),
    quote: boundedText, explanation: z.string().trim().min(40).max(8_000),
    difficulty: z.enum(["easy", "medium", "hard"]),
    options: z.array(z.object({ key: z.enum(["A", "B", "C", "D", "E"]),
      text: z.string().trim().min(1).max(2_000), correct: z.boolean(),
      rationale: z.string().trim().min(10).max(4_000) }).strict()).min(2).max(5),
  }).strict()).max(5).default([]),
}).strict();
export type AgentWorkResult = z.infer<typeof agentWorkResultSchema>;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export function agentInputHash(payload: AgentWorkPayload) {
  return createHash("sha256").update(JSON.stringify(canonical(workPayloadSchema.parse(payload)))).digest("hex");
}
const normalize = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim();

export function validateDiscoveryUrl(input: string) {
  const url=new URL(input);
  if (url.protocol!=="https:" || url.username || url.password || url.port || discoveryPathBlocked(input) || /gabarito|caderno|questoes/i.test(url.pathname)) {
    throw new Error("Origem ou material não autorizado para descoberta.");
  }
  const bankHosts=["www.vunesp.com.br","www.cebraspe.org.br","www.concursosfcc.com.br","conhecimento.fgv.br"];
  if (!bankHosts.includes(url.hostname)) parseOfficialOpportunitySourceUrl(input);
  url.hash="";
  return url.toString();
}

/** Validação de contrato não equivale a revisão jurídica ou atestado de originalidade. */
export function validateAgentWorkResult(kind: AgentWorkKind, payload: AgentWorkPayload, input: unknown) {
  const result = agentWorkResultSchema.parse(input);
  if (result.outcome === "blocked" && (!result.limitations.length || result.questions.length || result.mappings.length || result.discoveries.length)) {
    throw new Error("Resultado bloqueado exige motivo e não pode conter propostas executáveis.");
  }
  if ((kind !== "legal_mapping" && result.mappings.length) || (kind !== "authoring" && result.questions.length) ||
      (kind !== "discovery" && result.discoveries.length)) throw new Error("Resultado incompatível com o papel reservado.");
  const articleById = new Map(payload.articles.map(article => [article.id, article]));
  for (const item of [...result.mappings, ...result.questions]) {
    const article = articleById.get(item.articleId);
    if (!article || normalize(item.quote).length < 20 || !normalize(article.text).includes(normalize(item.quote))) {
      throw new Error("Fundamento não pertence ao corpus oficial versionado desta tarefa.");
    }
  }
  if (new Set(result.mappings.map(item => item.articleId)).size !== result.mappings.length) throw new Error("Mapeamento duplicado.");
  for (const discovery of result.discoveries) {
    validateDiscoveryUrl(discovery.url);
    if (/gabarito|caderno.{0,20}prova|quest[oõ]es/i.test(discovery.title)) throw new Error("Material de prova não é edital.");
    if (Date.parse(discovery.observedAt) > Date.now() + 300_000) throw new Error("Observação no futuro.");
  }
  for (const question of result.questions) {
    const keys = payload.bank === "cebraspe" ? ["A", "B"] : ["A", "B", "C", "D", "E"];
    if (!result.generatorModel || !payload.bank || !payload.role || question.options.length !== keys.length ||
        question.options.some((option, index) => option.key !== keys[index]) ||
        question.options.filter(option => option.correct).length !== 1 ||
        new Set(question.options.map(option => normalize(option.text).toLowerCase())).size !== keys.length) {
      throw new Error("Questão sem cargo/banca, alternativas distintas ou resposta única.");
    }
  }
  if (new Set(result.questions.map(item => normalize(item.prompt).toLowerCase())).size !== result.questions.length) throw new Error("Enunciados duplicados no lote.");
  if (result.outcome === "prepared" && ((kind === "legal_mapping" && !result.mappings.length) ||
      (kind === "authoring" && !result.questions.length))) throw new Error("Resultado preparado está vazio.");
  return result;
}
