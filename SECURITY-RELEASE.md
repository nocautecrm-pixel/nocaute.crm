# First five security priorities

## Release behavior

1. Database writes to billing, quota, deletion requests, provider accounts, restaurants, customers, campaigns and jobs require the server service role. Owners retain tenant-scoped reads. Internal RPCs are unavailable to anonymous and authenticated client roles. Deletion requests now have RLS.
2. The worker checks the current customer, proof, campaign and tenant immediately before each initial, media and CTA send. Persistent phone suppression survives customer deletion/reimport. Stale edits and old confirmation clicks cannot restore consent. A refreshed customer editor requires a new proof and the current revocation timestamp before explicit restoration.
3. A durable, unique attempt precedes each provider effect. An accepted receipt is reused after persistence/settlement failures. An uncertain attempt is held for reconciliation instead of automatically resent. Checkout requests are serialized per restaurant and completed results reused. Existing provider subscriptions require deliberate reconciliation before starting another checkout.
4. Imports authenticate before parsing/analyzing. Limits: 8 MB upload, 16 MB total ZIP expansion, 8 MB per entry, 256 entries, 5,012 sheet rows, 5,000 customers, 100 columns, 150,000 cells, 10,000 characters per cell. Malformed XML extraction advances linearly. Tenant budgets allow 100 import requests and 20 AI calls per database day, each with an exclusive two-minute lease. Paid AI has a 30-second timeout and bounded request/response/tokens. Model output never supplies consent.
5. Production compilation and lint failures are repaired. Worker readiness returns 503 until workers, Redis and the migration-backed database are ready. `/live` reports process liveness. Shutdown drains workers.

## Deployment order

Apply migration 0020 before deploying either application process. It is additive except for tightened grants and the replacement quota settlement function; existing service-role callers remain compatible.

For a coordinated worker rollout, use the production Redis environment with `node scripts/security-queues.mjs pause`, wait for both outbound queues to have zero active jobs, then deploy the worker. Leave `webhook-ingest` running so opt-outs keep processing. Do not use the local development Redis as proof of production queue state. Resume using `node scripts/security-queues.mjs resume` only after the correct worker revision reports ready and the prior worker is gone.

Use `node scripts/security-db.mjs inspect` to save permission metadata before/after migration. This reads no customer records. `node scripts/security-db.mjs apply <SHA256>` requires the reviewed migration file's SHA-256, applies it in a transaction, verifies client write/RPC restrictions, and records the digest in a protected release ledger. Provide `SUPABASE_DB_URL` through the environment and the official Supabase CA through `NODE_EXTRA_CA_CERTS` or `SUPABASE_DB_CA_CERT`. Certificate verification remains enabled. Never commit connection secrets.

Deploy the web app through its existing GitHub/Vercel integration. Deploy the worker only to the existing Nocaute Railway project/service, never a different account's project. Keep `TOKEN_ENCRYPTION_KEY` identical between Vercel and Railway. Optional emergency environment switches: `OUTBOUND_SENDS_PAUSED=true` and `NEW_CHECKOUTS_PAUSED=true` (effective only after this code is running).

## Recovery and residual limits

- Do not delete/reset a started or uncertain attempt to make a retry succeed. Reconcile its provider result first. A known provider receipt can be recorded as accepted; otherwise hold for operator review. No automatic exactly-once claim is made across provider/network failures.
- Existing confirmed/offer-sent jobs are seeded as uncertain to avoid replaying legacy media/CTA effects without receipts. Initial legacy attempts without proof of being unsent are held. This prioritizes avoiding duplicates over delivery availability.
- Provider failures after a claim, even some definite rejections, are conservatively held. A checkout with an existing subscription is also held for review; this release does not implement automatic subscription replacement or upgrades.
- An opt-out committed after the final claim can race an already-starting network request. A provider-accepted message cannot be recalled. Checks cover each separate offer step.
- Suppression hashes still reference personal data. They require an explicit retention policy; full restaurant erasure cascades them. They are not anonymous analytics.
- Quota settlement is idempotent per live job. Historical counter drift and reservations for erased jobs need reconciliation; this release does not rewrite historical ledger data.
- Rolling back to the old worker removes send protections. Keep the migration and outbound queues paused during any rollback; repair forward before resuming.

## Validation

`npm test`: synthetic Postgres/PGlite permission and lifecycle checks plus application-boundary tests for ZIP/XML/CSV limits, body limits, AI budget/consent handling, checkout serialization, stale customer forms, send retry settlement, and readiness. No real WhatsApp messages, paid AI calls or Asaas subscriptions are created by the tests.

`npm run lint`, `npm run typecheck`, `npm run build`: required application checks. The existing Next middleware deprecation warning remains.

PGlite tests exercise SQL permissions and transitions but do not prove production multi-connection timing. Provider boundaries are mocked. Production completion additionally requires migration permission verification, a successful Vercel deployment, and the correct Railway worker revision/readiness. Local passing tests alone do not establish deployment.
