import { LocalImportError } from "./local-import-plan";
import { requireLocalImportTarget } from "./local-import-target";

export function requireEditorialOperationTarget(connectionString: string | undefined, environment: {
  nodeEnv?: string; appUrl?: string; approval?: string;
}) {
  if (environment.nodeEnv !== "production") return requireLocalImportTarget(connectionString);
  if (environment.appUrl !== "https://leiprova.2b.app.br" || environment.approval !== "leiprova-160-2026-09-05" || !connectionString) {
    throw new LocalImportError("Operação de produção não habilitada explicitamente para este lote da Editalume.");
  }
  let target: URL;
  try { target = new URL(connectionString); } catch { throw new LocalImportError("Destino editorial inválido."); }
  if (!["postgres:", "postgresql:"].includes(target.protocol) || !["leiprova-pooler", "pooler"].includes(target.hostname) ||
      (target.port && target.port !== "5432") || target.pathname !== "/leiprova" || target.username !== "leiprova_app" || target.search || target.hash) {
    throw new LocalImportError("Exige pooler interno e papel restrito do banco exclusivo da Editalume, sem redirecionamento.");
  }
  return { connectionString, database: "leiprova" };
}
