import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const parts = files.map(
  (file) => `-- ========== ${file} ==========\n${readFileSync(join(dir, file), "utf8")}`,
);

const outPath = join(root, "supabase", "bootstrap-all.sql");
writeFileSync(outPath, parts.join("\n\n"), "utf8");
console.log(`Gerado supabase/bootstrap-all.sql (${files.length} arquivos)`);
console.log("Supabase → SQL Editor → New query → cole o arquivo inteiro → Run");
