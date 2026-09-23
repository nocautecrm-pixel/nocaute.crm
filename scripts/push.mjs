/**
 * Push com conta GitHub Nocaute (nunca AltercadiaOnline).
 * Uso: node scripts/push.mjs [args extra para git push]
 *      npm run push
 *      npm run deploy
 */
import { spawnSync } from "node:child_process";
import { ensureNocauteGithubAuth } from "./ensureNocauteGithubAuth.mjs";

ensureNocauteGithubAuth();

const extra = process.argv.slice(2);
const args = extra.length > 0 ? ["push", ...extra] : ["push"];

const result = spawnSync("git", args, {
  stdio: "inherit",
  encoding: "utf8",
  shell: false,
});

process.exit(result.status ?? 1);
