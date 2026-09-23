import pg from "pg";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const raw = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!raw) throw new Error("Database connection is not configured.");
const client = new pg.Client({ connectionString: raw, connectionTimeoutMillis: 10_000,
  ssl: { rejectUnauthorized: true, ...(process.env.SUPABASE_DB_CA_CERT ? { ca: process.env.SUPABASE_DB_CA_CERT } : {}) } });
const tables = ["subscriptions", "quota_accounts", "quota_ledger", "data_deletion_requests", "whatsapp_accounts", "restaurants", "customers", "campaign_jobs", "campaigns"];
const functionNames = ["ensure_quota_account", "reserve_campaign_quota", "settle_campaign_quota", "release_campaign_quota", "apply_subscription_plan", "claim_delivery", "confirm_campaign_offer", "restore_customer_consent", "protect_customer_consent", "claim_import_budget", "release_import_budget"];
async function functions() {
  return (await client.query(`select p.oid::regprocedure::text as signature,p.prosecdef as security_definer,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as owner_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any($1::text[])`, [functionNames])).rows;
}
async function permissions() {
  return (await client.query(`select r.role,t.name,
    has_table_privilege(r.role,'public.'||t.name,'SELECT') as can_read,
    has_table_privilege(r.role,'public.'||t.name,'UPDATE') as can_update,
    has_table_privilege(r.role,'public.'||t.name,'INSERT') as can_insert,
    has_table_privilege(r.role,'public.'||t.name,'DELETE') as can_delete,
    has_any_column_privilege(r.role,'public.'||t.name,'UPDATE') as column_update,
    has_any_column_privilege(r.role,'public.'||t.name,'INSERT') as column_insert,
    c.relrowsecurity as rls
    from unnest($1::text[]) t(name) cross join (values ('anon'),('authenticated'),('service_role')) r(role)
    join pg_class c on c.oid=('public.'||t.name)::regclass order by t.name,r.role`, [tables])).rows;
}
try {
  await client.connect();
  await client.query("set statement_timeout = '15s'");
  const mode = process.argv[2] || "inspect";
  if (mode === "apply") {
    const sql = readFileSync(new URL("../supabase/migrations/0020_security_priorities.sql", import.meta.url), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    if (process.argv[3] !== hash) throw new Error("Reviewed migration checksum required.");
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(20260915,20)");
    await client.query(`create table if not exists public.security_release_migrations (
      name text primary key,sha256 text not null,applied_at timestamptz not null default now());
      alter table public.security_release_migrations enable row level security;
      revoke all on public.security_release_migrations from public,anon,authenticated;
      grant all on public.security_release_migrations to service_role;`);
    const prior = await client.query("select sha256 from public.security_release_migrations where name=$1", ["0020_security_priorities.sql"]);
    if (prior.rows.length) {
      if (prior.rows[0].sha256 !== hash) throw new Error("Applied migration has a different checksum.");
    } else {
      await client.query(sql.replace(/^begin;\s*$/mi, "").replace(/^commit;\s*$/mi, ""));
      const matrix = await permissions();
      if (matrix.some(r => r.role !== "service_role" && (r.can_update || r.can_insert || r.can_delete || r.column_update || r.column_insert))) {
        throw new Error("Direct client mutation still permitted; migration rolled back.");
      }
      if ((await functions()).some(r => r.anon_execute || r.owner_execute)) throw new Error("Internal RPC remains public; migration rolled back.");
      await client.query("insert into public.security_release_migrations(name,sha256) values($1,$2)", ["0020_security_priorities.sql",hash]);
    }
    await client.query("commit");
    console.log(JSON.stringify({ migration: "0020_security_priorities.sql", sha256: hash, applied: true }));
  } else if (mode !== "inspect") throw new Error("Unknown mode.");
  await client.query("begin read only");
  console.log(JSON.stringify({ permissions: await permissions(),
    functions: await functions(),
    jobCounts: (await client.query("select status,count(*)::integer as count from public.campaign_jobs group by status")).rows,
  }, null, 2));
  await client.query("rollback");
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(JSON.stringify({ error: error.code || error.name, message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, "[connection redacted]") }));
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
