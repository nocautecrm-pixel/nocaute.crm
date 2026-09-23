/**
 * Garante a conta GitHub do deploy Nocaute antes do `git push`.
 * Evita misturar com AltercadiaOnline.
 *
 * Override: DEPLOY_GH_USER=OutraConta
 *
 * Uso:
 *   node scripts/ensureNocauteGithubAuth.mjs
 *   npm run push
 *   npm run deploy
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const NOCAUTE_GH_USER = process.env.DEPLOY_GH_USER ?? "nocautecrm-pixel";

export function ensureNocauteGithubAuth() {
  const result = spawnSync("gh", ["auth", "switch", "--user", NOCAUTE_GH_USER], {
    stdio: "inherit",
    encoding: "utf8",
    shell: false,
  });

  if (result.status !== 0) {
    console.error(`[deploy] Conta GitHub ativa precisa ser "${NOCAUTE_GH_USER}".`);
    console.error("[deploy] Rode: gh auth login -h github.com -p https -w  (conta Nocaute)");
    console.error("[deploy] Depois: gh auth status  → Active account = nocautecrm-pixel");
    process.exit(1);
  }

  console.log(`[deploy] GitHub ativo: ${NOCAUTE_GH_USER}`);
}

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  ensureNocauteGithubAuth();
}
