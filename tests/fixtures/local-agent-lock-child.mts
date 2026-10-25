import { withLocalAgentLock } from "../../src/lib/editorial/local-agent-dispatch";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
const root = process.argv[2];
const mode = process.argv[3];
if (mode === "kill-before-detach" || mode === "kill-after-detach") {
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (from === path.join(root, ".dispatch-Autor.lock") && mode === "kill-before-detach") process.kill(process.pid, "SIGKILL");
    rename(from, to);
    if (from === path.join(root, ".dispatch-Autor.lock") && mode === "kill-after-detach") process.kill(process.pid, "SIGKILL");
  };
  syncBuiltinESMExports();
}
await withLocalAgentLock(root, "Autor", async () => {
  const timer = setInterval(() => undefined, 1000);
  try {
    process.send?.({ stage: "entered" });
    await new Promise<void>(resolve => process.once("message", () => resolve()));
  } finally { clearInterval(timer); }
});
process.send?.({ stage: "released" });
process.disconnect?.();
