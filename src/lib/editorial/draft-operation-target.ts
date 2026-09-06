import { importFingerprint, LocalImportError } from "./local-import-plan";
import { requireLocalImportTarget } from "./local-import-target";

/** A confirmação cobre também quem opera e quais arquivos compõem o pacote. */
export function draftOperationFingerprint(contentFingerprint: string, manifest: {
  operatorPublicId: string; sourceBundleId: string; batchFiles: readonly string[];
}) {
  return importFingerprint({ version: "draft-operation-v1", contentFingerprint,
    operatorPublicId: manifest.operatorPublicId, sourceBundleId: manifest.sourceBundleId, batchFiles: manifest.batchFiles });
}

/** Importa somente rascunhos. Não reutiliza a autorização humana do lote de 160. */
export function requireDraftOperationTarget(connectionString: string | undefined, environment: {
  nodeEnv?: string; appUrl?: string; approval?: string; sourceBundleId: string;
}) {
  if (environment.nodeEnv !== "production") return requireLocalImportTarget(connectionString);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(environment.sourceBundleId) ||
      environment.appUrl !== "https://leiprova.2b.app.br" ||
      environment.approval !== `draft-only:${environment.sourceBundleId}` || !connectionString) {
    throw new LocalImportError("Habilite explicitamente a importação somente de rascunhos para este pacote da Editalume.");
  }
  let target: URL;
  try { target = new URL(connectionString); } catch { throw new LocalImportError("Destino de rascunhos inválido."); }
  if (!["postgres:", "postgresql:"].includes(target.protocol) ||
      !["leiprova-pooler", "pooler"].includes(target.hostname) ||
      (target.port && target.port !== "5432") || target.pathname !== "/leiprova" ||
      target.username !== "leiprova_app" || target.search || target.hash) {
    throw new LocalImportError("Exige pooler interno, banco exclusivo da Editalume e papel restrito, sem redirecionamento.");
  }
  return { connectionString, database: "leiprova" };
}
