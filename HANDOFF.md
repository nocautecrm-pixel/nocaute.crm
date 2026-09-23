# Handoff — Nocaute CRM

Documento para o próximo desenvolvedor fullstack. Descreve o que o projeto **é hoje**: produto, stack, pastas, APIs e integrações. Sugestões de evolução ficam abertas para análise; no final há apenas um caminho possível como referência.

---

## 1. Produto

CRM WhatsApp oficial para restaurante (saladeria): base de clientes, segmentos por **recência** (dias sem comprar), campanhas com templates Meta, cupom único por cliente e rastreamento de ROI.

| Segmento | Dias sem comprar |
|---|---|
| Ativos | 0–15 |
| Em risco | 16–30 |
| Inativos | 31–60 |
| Perdidos | 61–120 (acima de 120 fora da fila) |

Conta GitHub de push do projeto: **nocautecrm-pixel**. Publicar com `npm run push` / `npm run deploy` (não misturar com outras contas).

---

## 2. Princípio de desenho atual

O browser **exibe** e **emite intenções**. O servidor valida, enfileira, aplica quota/consentimento, cifra tokens e grava no banco. ROI e disparo WhatsApp não são feitos no cliente.

Canal oficial em uso: **WhatsApp Cloud API + Embedded Signup** (Meta). Não há automação de WhatsApp Web nem libs não oficiais no fluxo de envio.

---

## 3. Stack

| Camada | Tecnologia |
|---|---|
| App | Next.js 16.3, React 19, TypeScript, Tailwind 4 |
| Auth + DB | Supabase (Postgres + Auth + RLS) |
| Fila | BullMQ + Redis (ioredis) |
| Worker | Node (`npm run worker` → `tsx src/workers/index.ts`) |
| Hosting web | Vercel |
| Validação | Zod |
| Import PDF | `unpdf` (+ OpenAI opcional) |
| Billing | Asaas (cartão/Pix), opcional até configurar env |

Porta local do app: **3001**.

---

## 4. Onde cada peça roda

```
[Browser lojista]
       │
       ▼
┌──────────────────────────┐
│  Next.js (Vercel)        │  UI + /api/* + webhooks Meta/Asaas
└──────────┬───────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
[Supabase]     [Redis — Railway]
 Postgres         filas BullMQ
 Auth + RLS           │
     ▲                ▼
     │        [Worker — Railway]
     │        npm run worker
     │                │
     └───────► Meta Graph API (token WABA da loja, cifrado)
              ► Asaas API (mensalidade)
              ► OpenAI (só import difícil, se configurado)
```

| Onde | Papel |
|---|---|
| **Vercel** | Site, APIs, webhooks Meta/Asaas, cron |
| **Railway** | Redis + worker de longo prazo |
| **Supabase** | Dados, Auth, RLS por restaurante |
| **Meta** | Cloud API, Embedded Signup, webhooks, templates |
| **Asaas** | Checkout / assinatura (se `ASAAS_*` preenchido) |

`TOKEN_ENCRYPTION_KEY` precisa ser **a mesma** na Vercel e no Railway (64 hex). Sem isso o worker não abre o token da loja.

Envs de referência (sem valores reais): `.env.example` (Vercel/local) e `.env.railway.example` (worker).

---

## 5. APIs e serviços externos conectados

### Meta — WhatsApp Cloud API

- Base: `https://graph.facebook.com/{META_GRAPH_VERSION}` (default `v21.0`)
- Código: `src/lib/whatsapp/` (`graph-client.ts`, `embedded-signup.ts`, `service.ts`, `signature.ts`, …)
- Envio: `POST /{phoneNumberId}/messages`
- Embedded Signup: code → token → grava WABA / phone em `whatsapp_accounts` (token cifrado)
- Webhook do app: `GET/POST /api/webhooks/whatsapp` (verify + `X-Hub-Signature-256`)
- App Review: `/api/meta/deauth`, `/api/meta/data-deletion`, `/api/meta/data-deletion/status`
- Templates em `public/templates/` (ex.: `retorno_15_dias`, `optin_confirmacao`) — precisam estar **APPROVED** na WABA da loja
- Callbacks esperados no painel Meta:
  - Webhook: `{NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`
  - Deauth: `{NEXT_PUBLIC_APP_URL}/api/meta/deauth`
  - Data deletion: `{NEXT_PUBLIC_APP_URL}/api/meta/data-deletion`

### Supabase

- Browser / SSR: anon key + cookies (`src/lib/supabase/client.ts`, `server.ts`)
- Server / worker: service role (`src/lib/supabase/admin.ts`)
- Auth callback: `/auth/callback`
- No painel Supabase: Site URL = `NEXT_PUBLIC_APP_URL`; Redirect = `{NEXT_PUBLIC_APP_URL}/auth/callback`

### Redis / BullMQ

- `REDIS_URL` (local: `npm run infra:redis` → Docker)
- Filas (`src/lib/queue/queues.ts`):
  - `campaign-send` — opt-in / disparo inicial
  - `campaign-offer` — mídia / CTA da oferta
  - `webhook-ingest` — eventos Meta (status, opt-out, etc.)
- Workers: `src/workers/send-campaign.ts`, `send-offer.ts`, `ingest-webhook.ts`
- Throughput default: 1 mensagem / 2500 ms (`WHATSAPP_MAX_MSGS_PER_WINDOW`, `WHATSAPP_WINDOW_MS`)
- Health do worker: `/` (ready) e `/live` (processo vivo)

### Asaas

- Sandbox: `https://api-sandbox.asaas.com/v3` · Produção: `https://api.asaas.com/v3`
- Código: `src/server/billing/asaas-client.ts`, `asaas-gateway.ts`, `quota-gateway.ts`
- Webhook: `POST /api/webhooks/asaas` (header `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN`)
- App: `/api/billing/checkout`, `/api/billing/quota`

### OpenAI (opcional — import de clientes)

- Default: `https://api.openai.com/v1` (ou proxy via `CUSTOMER_IMPORT_AI_BASE_URL`)
- Uso: PDF difícil / foto / print em `src/lib/customers/import-agent/`
- CSV, Excel e PDF com texto legível funcionam sem chave
- Saída do modelo **não** define consentimento / opt-in

---

## 6. Árvore do repositório (o que importa)

```
/
├── src/
│   ├── app/                 # App Router: páginas + route handlers
│   │   ├── (dashboard)/     # Área logada
│   │   ├── api/             # REST interno + webhooks
│   │   ├── auth/callback/   # OAuth Supabase
│   │   └── …                # login, cadastro, privacidade, termos, opt-in
│   ├── middleware.ts        # Auth + “backend ready”
│   ├── components/          # UI por domínio
│   ├── lib/                 # whatsapp, queue, supabase, crypto, import…
│   ├── server/              # Regras de negócio (fonte da verdade)
│   ├── workers/             # Processo Railway
│   └── types/
├── supabase/migrations/     # 0001 … 0020 (schema + RLS)
├── public/templates/        # JSON dos templates Meta
├── scripts/                 # setup, push, security, bootstrap
├── tests/                   # security + database (PGlite)
├── .env.example
├── .env.railway.example
├── docker-compose.yml       # Redis local
├── vercel.json              # Cron anonimizar logs
├── railway.toml             # startCommand = npm run worker
├── README.md
├── SECURITY-RELEASE.md      # Ordem de deploy / migração 0020
└── HANDOFF.md               # Este arquivo
```

### `src/server/` — negócio

| Área | Arquivos |
|---|---|
| Clientes | `customers.ts`, `customer-board.ts` |
| Campanhas | `campaigns.ts` |
| Públicos | `audiences.ts` |
| Loja / onboarding | `store.ts`, `restaurant-provision.ts`, `tenant.ts` |
| WhatsApp | `whatsapp-account.ts`, `whatsapp-health.ts`, `webhooks.ts` |
| Cupom / ROI | `conversions.ts`, `roi.ts` |
| Mídia | `media.ts` |
| Billing | `billing/asaas-*.ts`, `billing/quota-*.ts` |
| Compliance | `compliance/delivery-guard.ts`, `erasure.ts`, `import-budget.ts`, `marketing-guard.ts`, `retention.ts` |
| Meta App Review | `meta-callbacks.ts` |
| Advisor UI | `advisor/` |

### `src/lib/whatsapp/`

Graph client, payloads, templates, janela 24h, telefone E.164, assinatura HMAC do webhook, Embedded Signup, parsing inbound.

---

## 7. Rotas de tela

**Públicas:** `/`, `/login`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha`, `/privacidade`, `/termos`, `/opt-in`, `/indisponivel`, `/completar-cadastro`

**Dashboard (autenticado):** `/painel`, `/visao-geral`, `/clientes`, `/campanhas`, `/campanhas/[id]`, `/resultados`, `/caixa`, `/integracao`, `/conectar-whatsapp`, `/configuracoes`, `/plano`, `/chatbot`

Middleware (`src/middleware.ts`): sem Supabase configurado e sem demo → `/indisponivel`. Paths de webhook Meta, meta callbacks e cron passam sem login de lojista.

---

## 8. APIs internas (`src/app/api`)

### Auth / loja

| Path | Uso |
|---|---|
| `/api/auth/onboarding` | Provisiona restaurante |
| `/api/auth/logout` | Logout |
| `/api/store/profile` | Perfil da loja |
| `/api/store/profile/clear` | Limpa campos |
| `/api/store/logo` | Logo |
| `/api/store/export` | Export |

### Clientes / audiências

| Path | Uso |
|---|---|
| `/api/customers` | Lista / cria |
| `/api/customers/[id]` | Lê / atualiza / remove |
| `/api/customers/[id]/visit` | Registra visita |
| `/api/customers/import` | Import CSV/XLSX/PDF (+ AI opcional) |
| `/api/audiences`, `/api/audiences/[id]` | Públicos |

### Campanhas / cupom

| Path | Uso |
|---|---|
| `/api/campaigns` | Lista / cria |
| `/api/campaigns/[id]/pause` · `resume` | Controle |
| `/api/campaigns/media` | Mídia da campanha |
| `/api/coupons/redeem` | Resgate no caixa |

### Meta

| Path | Uso |
|---|---|
| `/api/meta/embedded-signup` | Conecta WABA |
| `/api/meta/disconnect` | Desconecta |
| `/api/meta/deauth` | Callback Meta |
| `/api/meta/data-deletion` (+ `/status`) | Exclusão de dados (Meta) |

### Billing / cron / webhooks

| Path | Uso |
|---|---|
| `/api/billing/checkout` | Inicia cobrança Asaas |
| `/api/billing/quota` | Quota do plano |
| `/api/webhooks/whatsapp` | Meta (público) |
| `/api/webhooks/asaas` | Asaas (token no header) |
| `/api/cron/anonymize-logs` | Cron Vercel `15 3 * * *` + `CRON_SECRET` |

---

## 9. Banco — migrations

Pasta: `supabase/migrations/`

| Migration | Conteúdo (resumo) |
|---|---|
| `0001` | `restaurants`, `customers` |
| `0002` | `whatsapp_accounts` (token cifrado) |
| `0003` | Campanhas / jobs |
| `0004` | Cupons |
| `0005` | RLS |
| `0006`–`0012` | Opt-in, oferta, schedule, compliance |
| `0007` | Store profile |
| `0008` | Chatbot DNA |
| `0009` / `0019` | Billing quota / preços |
| `0013` | Media storage |
| `0014` | Store ops |
| `0015` | Audiences |
| `0016`–`0017` | order_count, imported_at |
| `0018` | Asaas billing |
| `0020` | Prioridades de segurança (grants/RLS/quota) — ver `SECURITY-RELEASE.md` |

Tenant = `restaurants.id` ↔ `auth.users` (`owner_user_id`). Telefone em E.164. Opt-in auditável no modelo atual (data + origem + prova).

---

## 10. Variáveis de ambiente (checklist)

**Vercel / `.env.local`** — ver `.env.example`:

- App: `NEXT_PUBLIC_APP_URL`, `ALLOW_DEMO` (só local)
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (+ `SUPABASE_DB_URL` só para scripts locais)
- Meta: `META_APP_ID`, `META_APP_SECRET`, `NEXT_PUBLIC_META_APP_ID`, `*_EMBEDDED_SIGNUP_CONFIG_ID`, `META_GRAPH_VERSION`, `WEBHOOK_VERIFY_TOKEN`
- Redis: `REDIS_URL`
- Segredos: `TOKEN_ENCRYPTION_KEY`, `COUPON_HMAC_SECRET`
- Throughput: `WHATSAPP_MAX_MSGS_PER_WINDOW`, `WHATSAPP_WINDOW_MS`
- Cron: `CRON_SECRET`
- Asaas (opcional): `ASAAS_ENV`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`
- Import AI (opcional): `OPENAI_API_KEY` / `CUSTOMER_IMPORT_AI_*`

**Railway worker** — ver `.env.railway.example`:

- `REDIS_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`
- Opcional: throughput e `META_GRAPH_VERSION`

Não commitar `.env` / `.env.local`. Não expor service role, Meta secret ou encryption key em issues/chat.

---

## 11. Fluxos atuais (como o código liga as peças)

### Conectar WhatsApp

UI Embedded Signup → `/api/meta/embedded-signup` → Graph (code → token) → token cifrado em `whatsapp_accounts`.

### Campanha

UI cria intenção → `src/server/campaigns.ts` (validação / opt-in / quota) → jobs no Redis → worker lê Supabase, descriptografa token, chama Graph API → status volta no webhook → fila `webhook-ingest`.

### Conversão

Cupom em `/caixa` ou inbound → `/api/coupons/redeem` / webhook → `conversions` / `roi`.

### Import

`/api/customers/import` → autenticação + limites → CSV/XLSX/PDF → LLM só se configurado.

### Cobrança

`/api/billing/checkout` → Asaas → webhook atualiza assinatura / quota.

---

## 12. Como subir local

```bash
npm install
npm run setup:env          # ou copiar .env.example → .env.local
npm run setup:check
# Rodar migrations no Supabase (SQL Editor) ou scripts setup:*
npm run infra:redis        # Redis Docker
npm run worker             # terminal 2
npm run dev                # http://localhost:3001
```

Scripts úteis: `setup:migrations`, `setup:bootstrap-sql`, `setup:store`, `setup:verify`, `test`, `lint`, `typecheck`, `build`.

Sem backend completo: modo demo local se `ALLOW_DEMO=true` (produção ignora).

---

## 13. Deploy

1. Migrations no Supabase (incluindo as novas; ver `SECURITY-RELEASE.md` para `0020`).
2. Vercel: repo + envs de `.env.example` (valores reais; `ALLOW_DEMO` vazio em prod).
3. Railway: mesmo projeto Nocaute — Redis + serviço `npm run worker` + envs de `.env.railway.example`.
4. Meta: app Live, webhooks no domínio, templates APPROVED.
5. Prova: cadastro → conectar WhatsApp → 1 mensagem real → 1 cupom no `/caixa`.

Push/publish: `npm run push` ou `npm run deploy` (auth GitHub Nocaute).

---

## 14. Leituras no repo

| Arquivo | Conteúdo |
|---|---|
| `README.md` | MVP + setup rápido |
| `.env.example` / `.env.railway.example` | Checklist de envs |
| `SECURITY-RELEASE.md` | Deploy seguro, filas, migração 0020 |
| `AGENTS.md` | Notas Next + segredos |
| `public/templates/*.json` | Templates a submeter na Meta |

---

## 15. Ênfase — caminho possível (para análise)

O núcleo atual já é: **Next.js (Vercel) + Supabase + Redis/BullMQ (Railway) + WhatsApp Cloud API oficial**, com regras de consentimento, fila e billing no servidor.

Um caminho possível a avaliar (não é decisão fechada) é:

1. **Manter** essa arquitetura como canal oficial de envio/recebimento e compliance Meta.
2. **Mapear** gaps de produto (ex.: automações extras, ops internas, relatórios) antes de introduzir nova camada de orquestração.
3. Se surgir necessidade de workflows visuais / integrações laterais, **avaliar** ferramentas como n8n **fora** do caminho crítico de envio, opt-out e cobrança — ou comparar custo/benefício de estender os workers existentes.
4. Qualquer mudança estrutural: validar impacto em Embedded Signup multi-tenant, `TOKEN_ENCRYPTION_KEY`, filas, RLS e App Review da Meta.

O próximo passo natural para quem assume o código: rodar local com Redis + worker, ler `src/server/campaigns.ts` + `src/workers/` + `src/lib/whatsapp/`, e repetir o fluxo “conectar → 1 envio → cupom no caixa” em ambiente de teste.
