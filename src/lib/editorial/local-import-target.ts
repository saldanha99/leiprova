import { LocalImportError } from "./local-import-plan";

/** O piloto de importação só escreve em bancos locais dedicados. Sem fallback para DATABASE_URL. */
export function requireLocalImportTarget(connectionString: string | undefined) {
  if (!connectionString) throw new LocalImportError("Configure LEIPROVA_IMPORT_DATABASE_URL para um banco editorial local dedicado.");
  let target: URL;
  try { target = new URL(connectionString); } catch { throw new LocalImportError("Conexão editorial local inválida."); }
  const targets = new Map([["/leiprova_automation_test", "55439"], ["/leiprova_editorial_local", "55440"]]);
  if (!["postgres:", "postgresql:"].includes(target.protocol) || target.hostname !== "127.0.0.1" ||
      targets.get(target.pathname) !== target.port || target.search || target.hash || !target.username) {
    throw new LocalImportError("Importação limitada a 127.0.0.1:55439/leiprova_automation_test ou 127.0.0.1:55440/leiprova_editorial_local, sem parâmetros extras.");
  }
  return { connectionString, database: target.pathname.slice(1) };
}
