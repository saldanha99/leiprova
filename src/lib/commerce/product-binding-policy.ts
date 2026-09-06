import { createHash } from "node:crypto";
import { z } from "zod";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const productBindingProposalSchema = z.object({
  productSlug: text(3, 160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  opportunityPublicId: z.uuid(),
  requirementId: z.number().int().positive(),
  questionPublicId: text(3, 200),
  requirementQuote: text(10, 20_000),
  legalQuote: text(15, 12_000),
  scopeNotes: text(30, 2_000),
}).strict();
export const productBindingPackageSchema = z.object({
  schemaVersion: z.literal(1),
  items: z.array(productBindingProposalSchema).min(1).max(250),
}).strict().superRefine(({ items }, context) => {
  const keys = items.map((item) => JSON.stringify([item.productSlug, item.requirementId, item.questionPublicId]));
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", path: ["items"], message: "O pacote repete a mesma proposta de vínculo." });
});

export const bindingFingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function containsVerbatimQuote(source: string, quote: string) {
  const normalize = (value: string) => value.normalize("NFC").replace(/\s+/gu, " ").trim();
  return normalize(source).includes(normalize(quote));
}

/** O importador não aceita DATABASE_URL implícita nem promove mapas à aprovação. */
export function requireProductBindingTarget(connectionString: string | undefined, appUrl?: string, nodeEnv?: string, approval?: string) {
  if (!connectionString) throw new Error("Defina LEIPROVA_BINDING_DATABASE_URL explicitamente.");
  const target = new URL(connectionString);
  const local = target.hostname === "127.0.0.1" && (
    (target.port === "55440" && target.pathname === "/leiprova_editorial_local") ||
    (target.port === "55441" && target.pathname === "/leiprova_binding_test")
  );
  const production = nodeEnv === "production" && appUrl === "https://leiprova.2b.app.br" && approval === "import_pending_bindings" &&
    ["leiprova-pooler", "pooler"].includes(target.hostname) && target.pathname === "/leiprova" &&
    target.username === "leiprova_app" && (!target.port || target.port === "5432");
  if (!["postgres:", "postgresql:"].includes(target.protocol) || target.search || target.hash || !target.username || (!local && !production)) {
    throw new Error("Destino de curadoria não permitido; use o banco editorial local ou pooler restrito da Editalume.");
  }
  return { connectionString, database: target.pathname.slice(1), production };
}
