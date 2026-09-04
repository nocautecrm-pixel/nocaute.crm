/**
 * Aplica migrations em ordem via Postgres (sem colar SQL no dashboard).
 *
 * Pré-requisito no .env.local:
 *   SUPABASE_DB_URL=postgresql://postgres.[ref]:[SENHA]@...supabase.com:6543/postgres
 *   (Supabase → Project Settings → Database → Connection string → URI)
 *
 * Uso: npm run setup:db
 */
import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");

const dbUrl =
  process.env.SUPABASE_DB_URL?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!dbUrl) {
  console.error("Falta SUPABASE_DB_URL no .env.local.");
  console.error("");
  console.error("Supabase → Project Settings → Database → Connection string → URI");
  console.error("Cole a linha completa (com a senha do banco, não a service_role key).");
  process.exit(1);
}

/** Senha com @ quebra postgresql://user:pass@host se o parser usar o primeiro @. */
function parseDbUrl(raw) {
  const stripped = raw.replace(/^postgres(ql)?:\/\//i, "");
  const at = stripped.lastIndexOf("@");
  if (at <= 0) {
    throw new Error("SUPABASE_DB_URL inválida (falta user@host).");
  }
  const creds = stripped.slice(0, at);
  const rest = stripped.slice(at + 1);
  const colon = creds.indexOf(":");
  if (colon < 0) {
    throw new Error("SUPABASE_DB_URL inválida (falta senha).");
  }
  const user = decodeURIComponent(creds.slice(0, colon));
  const password = decodeURIComponent(creds.slice(colon + 1));
  const slash = rest.indexOf("/");
  const hostPort = slash >= 0 ? rest.slice(0, slash) : rest;
  const database = (slash >= 0 ? rest.slice(slash + 1) : "postgres").split("?")[0] || "postgres";
  const ipv6 = hostPort.startsWith("[");
  let host;
  let port = 5432;
  if (ipv6) {
    const end = hostPort.indexOf("]");
    host = hostPort.slice(1, end);
    if (hostPort[end + 1] === ":") port = Number(hostPort.slice(end + 2));
  } else {
    const lastColon = hostPort.lastIndexOf(":");
    if (lastColon > 0 && !hostPort.includes("]")) {
      host = hostPort.slice(0, lastColon);
      port = Number(hostPort.slice(lastColon + 1)) || 5432;
    } else {
      host = hostPort;
    }
  }
  return { user, password, host, port, database };
}

const only = process.argv[2];
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .filter((name) => !only || name === only || name.startsWith(only));

if (!files.length) {
  console.error("Nenhum arquivo em supabase/migrations/");
  process.exit(1);
}

const parsed = parseDbUrl(dbUrl);
const refFromHost = parsed.host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1];

const attempts = [];
if (refFromHost) {
  for (const host of [
    "aws-0-us-west-2.pooler.supabase.com",
    "aws-1-us-west-2.pooler.supabase.com",
  ]) {
    attempts.push({
      ...parsed,
      host,
      port: 6543,
      user: `postgres.${refFromHost}`,
    });
  }
} else {
  attempts.push({ ...parsed, port: 5432 });
  if (parsed.port !== 5432) {
    attempts.push(parsed);
  }
}

let client;
let lastError;
for (const attempt of attempts) {
  console.log(`Tentando ${attempt.user}@${attempt.host}:${attempt.port}`);
  const next = new pg.Client({
    host: attempt.host,
    port: attempt.port,
    user: attempt.user,
    password: attempt.password,
    database: attempt.database,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await next.connect();
    client = next;
    break;
  } catch (error) {
    lastError = error;
    console.error(`  falhou: ${error.message}`);
    try {
      await next.end();
    } catch {
      /* ignore */
    }
  }
}

if (!client) {
  console.error("\nErro:", lastError?.message ?? "não conectou");
  if (String(lastError?.message).includes("ETIMEDOUT")) {
    console.error("→ Host direto é IPv6. Cole no .env.local a URI do pooler (Connect → URI, porta 6543).");
  }
  if (String(lastError?.message).includes("password authentication failed")) {
    console.error("→ User no pooler deve ser postgres.PROJECTREF, não só postgres.");
  }
  process.exit(1);
}

try {
  console.log(`Conectado. ${files.length} migration(s)…`);

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    process.stdout.write(`  ${file} … `);
    await client.query(sql);
    console.log("ok");
  }

  console.log("\nMigrations aplicadas. Rode: npm run setup:verify");
} catch (error) {
  console.error("\nErro:", error.message);
  if (error.message.includes("getaddrinfo ENOTFOUND")) {
    console.error("→ Host do banco não existe. Confira o project ref no Supabase.");
  }
  if (error.message.includes("password authentication failed")) {
    console.error("→ A URI pode estar certa e o host direto (IPv6) recusar o user postgres.");
    console.error("  Use Connect → URI (pooler, porta 6543), user postgres.SEU-REF.");
  }
  process.exit(1);
} finally {
  await client.end();
}
