import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { requireStandingCourseMaintenanceDatabaseUrl } from "../src/lib/editorial/official-course-admission";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "../src/lib/editorial/official-course-dossier";
import { reconcileOfficialRoleScope } from "../src/lib/editorial/official-role-scope-maintenance";

async function main() {
  const args = new Map<string,string>(); let apply = false;
  for (const item of process.argv.slice(2)) {
    if (item === "--apply" && !apply) { apply = true; continue; }
    const match = /^--(recipe|actor|fingerprint)=(.+)$/u.exec(item);
    if (!match || args.has(match[1])) throw new Error("Use --recipe=RECORTE --actor=UUID; --apply requires --fingerprint=SHA256.");
    args.set(match[1],match[2]);
  }
  if (!args.get("recipe") || !args.get("actor") || (!apply && args.has("fingerprint"))) throw new Error("Explicit bounded recipe, administrator and preview required.");
  const client = postgres(requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL), { max:1, prepare:false, connect_timeout:5, idle_timeout:10 });
  try {
    const [identity] = await client`select current_database() name,current_user username`;
    if (identity.name !== "leiprova" || identity.username !== "leiprova_owner") throw new Error("Incorrect project identity.");
    const result = await reconcileOfficialRoleScope(drizzle(client,{schema}),{ input:{recipe:args.get("recipe")}, actorPublicId:args.get("actor")!,
      approvalReference:OFFICIAL_COURSE_STANDING_REFERENCE, mode:apply ? "apply" : "preview", expectedFingerprint:args.get("fingerprint") });
    console.log(JSON.stringify(result,null,2));
  } finally { await client.end(); }
}
main().catch(() => { console.error("Role scope not applied. Check source, edition, dependencies, reservations, actor and preview fingerprint. Connection data omitted."); process.exitCode=1; });
