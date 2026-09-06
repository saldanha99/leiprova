import { z } from "zod";
import type { ProductBindingReviewDossier } from "./product-binding-review-policy";

export function isTrustedBindingReviewOrigin(origin: string | null, configuredUrl: string | undefined, production: boolean) {
  try {
    if (!origin || !configuredUrl) return false;
    const actual = new URL(origin), expected = new URL(configuredUrl);
    return actual.origin === origin && !actual.username && !actual.password &&
      ["http:", "https:"].includes(expected.protocol) && (!production || expected.protocol === "https:") &&
      !expected.username && !expected.password && actual.origin === expected.origin;
  } catch { return false; }
}

export const bindingAdminSelectionSchema = z.object({
  productSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u).min(3).max(160),
  bindingId: z.string().regex(/^[a-f0-9]{64}$/u),
  opportunityPublicId: z.uuid(), examEditionPublicId: z.uuid(),
  notes: z.string().trim().min(20).max(2_000), decision: z.enum(["approve", "reject"]),
}).strict();
export type BindingAdminSelection = z.infer<typeof bindingAdminSelectionSchema>;
export type BindingAdminRow = {
  bindingId: string; status: string; prompt: string; questionStatus: string;
  opportunityPublicId: string; opportunityTitle: string; roleName: string;
  examEditionPublicId: string | null; editionTitle: string | null; bankName: string | null;
  productAssociated: boolean; sourceLocator: string;
};
export type BindingDossierView = {
  bindingId: string; eligible: boolean; status: string; prompt: string; explanation: string;
  options: { key: string; text: string; correct: boolean; rationale: string }[];
  fields: { label: string; value: string }[]; links: { label: string; url: string }[];
  blockers: string[];
};
export type BindingReviewState = {
  status: "idle" | "preview" | "success" | "error"; message: string;
  preview?: { selection: BindingAdminSelection; fingerprint: string; dossier: BindingDossierView;
    reviewerAllowed: boolean; requiresOwnerOverride: boolean };
};
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value : "Não informado";
const present = (value: unknown) => value !== null && value !== undefined;

/** Somente campos editoriais necessários atravessam RSC; nunca usuários, e-mails ou snapshot bruto. */
export function toBindingDossierView(dossier: ProductBindingReviewDossier): BindingDossierView {
  const s = dossier.snapshot, q = record(s.question), b = record(s.binding), r = record(s.requirement);
  const source = record(s.source), edition = record(s.edition), opportunity = record(s.opportunity);
  const product = record(s.product), version = record(s.version), article = record(s.article);
  const documentSnapshot = record(s.documentSnapshot);
  const original = q.source_rights === "original_authorial";
  const blockers: string[] = [];
  if (!present(edition.public_id)) blockers.push("Edição oficial ainda não vinculada à oportunidade.");
  if (!present(product.opportunity_id) || product.opportunity_id !== opportunity.id) blockers.push("Produto ainda não associado a esta oportunidade.");
  if (q.editorial_status !== "reviewed") blockers.push("Questão sem revisão jurídica concluída; este formulário não a aprova.");
  if (!original) blockers.push("Conteúdo não autoral oculto; não elegível para aprovação neste fluxo.");
  if (!q.clean_room_attested_at || !q.created_by_user_id) blockers.push("Declaração editorial/autoria da questão pendente.");
  if (r.editorial_status !== "reviewed") blockers.push("Requisito do programa ainda não revisado.");
  if (source.status !== "approved") blockers.push("Fonte do edital ainda não aprovada.");
  if (article.editorial_status !== "reviewed" || version.status !== "current") blockers.push("Artigo/versão normativa não atende ao estado editorial exigido.");
  if (!dossier.eligible) blockers.push("A regra completa rejeitou a aprovação: confira também hashes, texto, mapeamento, banca e versões históricas.");
  const fields = [
    ["Cargo", opportunity.role_name], ["Oportunidade", opportunity.title], ["Edição", edition.title],
    ["Estado da questão", q.editorial_status], ["Formato / modo", `${text(q.type)} / ${text(q.quiz_mode)}`],
    ["Questão atualizada em", q.updated_at], ["Versão da questão proposta", b.question_updated_at],
    ["Estado da fonte / documento", `${text(source.status)} / ${text(documentSnapshot.status)}`],
    ["Hash do documento", documentSnapshot.checksum], ["Hash do documento proposto", b.source_snapshot_checksum],
    ["Requisito atual", r.requirement_text], ["Localizador proposto", b.source_locator],
    ["Trecho do programa proposto", b.requirement_quote], ["Trecho normativo proposto", b.legal_quote],
    ["Texto normativo atual", article.literal_text], ["Justificativa de aderência proposta", b.scope_notes],
    ["Hash da versão normativa", version.checksum_sha256], ["Hash proposto", b.legal_version_checksum],
    ["Bancas e estados", (Array.isArray(s.organizers) ? s.organizers : []).map((entry) => {
      const item = record(entry); return `${text(record(item.bank).name)} · ${text(record(item.assignment).status)}`;
    }).join("; ") || "Organizadora não registrada"],
  ].map(([label, value]) => ({ label: String(label), value: text(value) }));
  const links: BindingDossierView["links"] = [];
  for (const [label, value] of [["Fonte do edital", source.source_url], ["Edição oficial", edition.official_url], ["Norma oficial", version.source_url]]) {
    if (typeof value !== "string") continue;
    try { const url = new URL(value); if (url.protocol === "https:" && !url.username && !url.password) links.push({ label: String(label), url: url.href }); } catch { /* URL inválida não vira link. */ }
  }
  return { bindingId: dossier.bindingId, eligible: dossier.eligible, status: dossier.bindingStatus,
    prompt: original ? text(q.prompt) : "Conteúdo não autoral oculto", explanation: original ? text(q.explanation) : "",
    options: original && Array.isArray(s.options) ? s.options.map((entry) => { const o = record(entry); return {
      key: text(o.option_key), text: text(o.text), correct: o.is_correct === true, rationale: text(o.rationale),
    }; }) : [], fields, links, blockers };
}
