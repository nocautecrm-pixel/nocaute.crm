import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("Postgres permissions, consent lifecycle, attempts, settlement, and budget", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to public;`);
    const migrations = new URL("../supabase/migrations/", import.meta.url);
    for (const file of readdirSync(migrations).filter(f => f.endsWith(".sql") && f < "0020" && !f.startsWith("0013")).sort()) {
      const sql = readFileSync(new URL(file,migrations), "utf8").replace('create extension if not exists "pgcrypto";', "");
      await db.exec(sql);
    }
    // Model the broad Supabase default grants, not an accidentally safe test DB.
    await db.exec("grant all on all tables in schema public to anon,authenticated,service_role");
    const owner = "10000000-0000-0000-0000-000000000001";
    const tenant = "20000000-0000-0000-0000-000000000001";
    const foreignTenant = "20000000-0000-0000-0000-000000000002";
    const customer = "30000000-0000-0000-0000-000000000001";
    const campaign = "40000000-0000-0000-0000-000000000001";
    const job = "50000000-0000-0000-0000-000000000001";
    await db.query("insert into auth.users(id) values($1)",[owner]);
    await db.query("insert into restaurants(id,name,owner_user_id) values($1,'Test tenant',$2)",[tenant,owner]);
    await db.query("insert into customers(id,restaurant_id,name,phone,opt_in,opt_in_at,opt_in_source,opt_in_proof) values($1,$2,'Test customer','+5511999999999',true,now(),'balcao','synthetic proof')",[customer,tenant]);
    await db.query("insert into campaigns(id,restaurant_id,name,segment,template_name,status) values($1,$2,'Test campaign','ativos','optin_confirmacao','running')",[campaign,tenant]);
    await db.query("insert into campaign_jobs(id,campaign_id,restaurant_id,customer_id) values($1,$2,$3,$4)",[job,campaign,tenant,customer]);
    await db.query("select reserve_campaign_quota($1,1,$2)",[tenant,campaign]);
    await db.exec(readFileSync(new URL("0020_security_priorities.sql",migrations),"utf8"));

    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
    await db.exec("set role authenticated");
    assert.equal((await db.query("select count(*)::int n from subscriptions")).rows[0].n,1);
    for (const sql of ["update quota_accounts set included=999999", "update subscriptions set status='active'", "update restaurants set asaas_customer_id='forged'", "update campaign_jobs set status='queued'", "select * from data_deletion_requests", "select * from whatsapp_accounts", "select * from delivery_attempts", `select ensure_quota_account('${tenant}')`, `select claim_import_budget('${tenant}','ai')`]) {
      await assert.rejects(db.exec(sql), /permission denied/);
    }
    await db.exec("reset role; set role anon");
    await assert.rejects(db.exec("select * from data_deletion_requests"), /permission denied/);
    await db.exec("reset role; set role service_role");
    const claim = async (t=tenant,phase="initial") => (await db.query("select claim_delivery($1,$2,$3,$4,$5) value",[t,campaign,job,customer,phase])).rows[0].value;
    assert.equal((await claim(foreignTenant)).state,"suppressed");
    assert.equal((await claim()).state,"claimed");
    assert.equal((await claim()).state,"started");
    await db.exec("update delivery_attempts set state='uncertain'");
    assert.equal((await claim()).state,"uncertain");
    await db.query("select settle_campaign_quota($1,'consume',$2,$3)",[tenant,campaign,job]);
    await db.query("select settle_campaign_quota($1,'consume',$2,$3)",[tenant,campaign,job]);
    await db.query("select settle_campaign_quota($1,'refund',$2,$3)",[tenant,campaign,job]);
    assert.deepEqual((await db.query("select used,reserved from quota_accounts")).rows[0],{used:1,reserved:0});
    assert.equal((await db.query("select count(*)::int n from quota_ledger where campaign_job_id=$1",[job])).rows[0].n,1);

    await db.query("update campaign_jobs set status='confirmed' where id=$1",[job]);
    assert.equal((await claim(tenant,"offer_media")).state,"claimed");
    await db.query("update customers set opt_in=false where id=$1",[customer]);
    assert.equal((await claim(tenant,"offer_cta")).state,"suppressed");
    // Stale read/import racing after STOP cannot restore consent, even if its
    // fabricated import timestamp is newer than the refusal.
    await db.query("update customers set opt_in=true,opt_in_at=now()+interval '1 day',opt_in_source='delivery',opt_in_proof='old import' where id=$1",[customer]);
    assert.equal((await db.query("select opt_in from customers where id=$1",[customer])).rows[0].opt_in,false);
    assert.equal((await db.query("select confirm_campaign_offer($1,$2,'5511999999999') ok",[tenant,job])).rows[0].ok,false);
    await assert.rejects(db.query("select restore_customer_consent($1,$2,'balcao','old proof',null)",[tenant,customer]), /Consentimento alterado/);
    await assert.rejects(db.query("select restore_customer_consent($1,$2,'balcao','old proof',now()-interval '1 day')",[tenant,customer]), /Consentimento alterado/);
    await db.query("select restore_customer_consent($1,$2,'balcao','new explicit consent',(select revoked_at from customer_suppressions where restaurant_id=$1))",[tenant,customer]);
    assert.equal((await db.query("select opt_in from customers where id=$1",[customer])).rows[0].opt_in,true);
    assert.equal((await db.query("select confirm_campaign_offer($1,$2,'5511888888888') ok",[tenant,job])).rows[0].ok,false);
    assert.equal((await db.query("select confirm_campaign_offer($1,$2,'5511999999999') ok",[tenant,job])).rows[0].ok,true);
    await db.query("delete from customers where id=$1",[customer]);
    await db.query("insert into customers(id,restaurant_id,name,phone,opt_in,opt_in_at,opt_in_source,opt_in_proof) values($1,$2,'Reimport','+5511999999999',true,now(),'delivery','old consent')",[customer,tenant]);
    assert.equal((await db.query("select opt_in from customers where id=$1",[customer])).rows[0].opt_in,false);

    const budget = async () => (await db.query("select claim_import_budget($1,'ai') token",[tenant])).rows[0].token;
    const first = await budget();
    await assert.rejects(budget(),/import_busy/);
    await db.query("select release_import_budget($1,'ai',$2)",[tenant,"99999999-9999-9999-9999-999999999999"]);
    await assert.rejects(budget(),/import_busy/);
    await db.query("select release_import_budget($1,'ai',$2)",[tenant,first]);
    for (let i=1;i<20;i++) {
      const token=await budget();
      await db.query("select release_import_budget($1,'ai',$2)",[tenant,token]);
    }
    await assert.rejects(budget(),/import_daily_limit/);
    // Parent erasure must not fail on the suppression trigger's FK.
    await db.query("delete from restaurants where id=$1",[tenant]);
    assert.equal((await db.query("select count(*)::int n from customer_suppressions")).rows[0].n,0);
  } finally { await db.close(); }
});
