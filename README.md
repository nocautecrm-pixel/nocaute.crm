# Nocaute CRM — Saladeria com Limão e Sal

CRM simples para o dono do restaurante: base de clientes, segmentação por
**recência** (dias sem comprar) e campanhas oficiais no WhatsApp
(Meta Cloud API), com cupom único por cliente e rastreamento de ROI.

> Compliance: apenas WhatsApp Cloud API + Embedded Signup.
> Não usamos automação de WhatsApp Web, scrapers nem libs não oficiais.

---

## O que o MVP faz

1. Mostra quem parou de ir (recência).
2. Enfileira uma oferta no WhatsApp **sem rajada** (protege o número).
3. Gera cupom único por cliente e campanha.
4. Marca conversão quando o cupom volta (webhook ou digitação no salão).

### Segmentos

| Segmento | Dias sem comprar |
|---|---|
| Ativos | 0–15 |
| Em risco | 16–30 |
| Inativos | 31–60 |
| Perdidos | 61–120 (acima de 120 fica fora da fila) |

---

## Arquitetura

```
[Lojista no browser]
        │
        ▼
┌───────────────────────┐
│  Next.js  (Vercel)    │  UI + APIs + webhook Meta
│  .env da Vercel       │
└──────────┬────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
[Supabase]     [Redis — Railway]
 Postgres        fila BullMQ
 Auth + RLS         │
     ▲              ▼
     │      [Worker Node — Railway]
     │      npm run worker
     │              │
     └──────► Graph API (token da WABA do lojista)
```

**Onde vai cada peça**

| Onde | O quê | Precisa do Supabase? |
|---|---|---|
| **Vercel** | Site + `/api/*` (criar campanha, signup, webhook) | Sim — grava loja, clientes, campanha, token cifrado |
| **Railway** | Redis + `npm run worker` (disparo) | Sim — o worker **lê o mesmo** Supabase para pegar a WABA e enviar |
| **Supabase** | Banco + login | É o cofre. Não substitui o Railway |

Railway **não** troca o Supabase. São dois papéis: fila/processo longo (Railway) e dados (Supabase). Sem o mesmo `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` no worker, a campanha entra na fila e não sai WhatsApp.

Envs prontos para colar depois: `.env.example` (Vercel/local) e `.env.railway.example` (worker).

---
O browser **nunca** dispara WhatsApp nem calcula ROI. O servidor valida,
enfileira e atualiza o banco. O front só exibe e emite intenções.

Campanhas proativas usam **Message Templates** aprovados pela Meta.
Texto livre só dentro da janela de 24h após mensagem do cliente.

---

## Stack

- Next.js 16 + React + TypeScript + Tailwind
- Supabase (Postgres + Auth + RLS)
- BullMQ + Redis (fila de disparo)
- Worker Node (`npm run worker`)
- Graph API oficial via `fetch` (sem Baileys / whatsapp-web.js)

---

## Como rodar

```bash
npm run dev
```

Painel em [http://localhost:3001](http://localhost:3001). Sem `.env` o app
abre em **modo demonstração** (clientes e ROI de exemplo).

Fila real de disparo (segundo terminal):

```bash
npm run infra:redis
npm run worker
```

Copie `.env.example` para `.env.local` e preencha quando tiver Supabase + Meta.

```bash
npm run setup:env          # gera .env.local + TOKEN + COUPON + WEBHOOK
npm run setup:migrations   # lista SQL para rodar no Supabase
npm run setup:check        # o que ainda falta preencher
```

Depois das migrations e de criar usuário no Auth:

```bash
# PowerShell — troque pelo UUID do usuário
$env:BOOTSTRAP_OWNER_USER_ID="uuid-do-auth"
npm run setup:store
```

### Primeiro deploy (nessa ordem)

1. **GitHub** — push desta branch.
2. **Supabase** — SQL Editor: rode só as migrations novas (ex.: `0013_media_storage.sql` e `0014_store_ops.sql`) se o banco já existia. Projeto novo: `npm run setup:bootstrap-sql` e cole `supabase/bootstrap-all.sql`.
3. **Vercel** — importe o repo. Cole `.env.example` **sem valores de exemplo**. Obrigatório: Supabase URL/anon/service_role, `NEXT_PUBLIC_APP_URL`, `TOKEN_ENCRYPTION_KEY`, `REDIS_URL` (o mesmo do Railway), `CRON_SECRET`, chaves Meta. `ALLOW_DEMO` vazio.
4. **Railway** — plugin Redis + serviço `npm run worker`. Cole `.env.railway.example`. `TOKEN_ENCRYPTION_KEY` **igual** à Vercel.
5. **Meta** — App Live. Webhook `https://SEU-DOMINIO/api/webhooks/whatsapp`. Deauth `/api/meta/deauth`. Data deletion `/api/meta/data-deletion`. Privacidade pública: `/privacidade`. Templates `retorno_15_dias` (e os outros JSON) **APPROVED** na WABA da loja.
6. **Prova** — `/cadastro` → conectar WhatsApp da casa → 1 mensagem no celular do dono → 1 cupom no `/caixa`.

`TOKEN_ENCRYPTION_KEY` igual na Vercel e no Railway (64 hex). Sem isso o worker não abre o token da loja.

---

## Pastas importantes

- `src/app/(dashboard)` — Clientes, Campanhas, Resultados
- `src/app/api` — webhooks, campanhas, cupons, Embedded Signup
- `src/server` — regras de negócio (fonte da verdade)
- `src/lib/whatsapp` — Cloud API oficial
- `src/lib/queue` + `src/workers` — disparo controlado
- `supabase/migrations` — schema + RLS

---

## Segurança e compliance Meta

- Token da WABA cifrado no servidor (`TOKEN_ENCRYPTION_KEY`)
- Webhook valida `X-Hub-Signature-256`
- RLS por restaurante
- Opt-in comprovado obrigatório: `opt_in_at` + `opt_in_source` + `opt_in_proof`
- Campanhas só disparam para base com opt-in auditável
- Limite Meta: 1 template MARKETING / 24h por número
- Throughput inicial: 1 mensagem a cada 2,5s (ajustável no `.env`)
- Callbacks App Review: `/api/meta/deauth` e `/api/meta/data-deletion`
- Templates pré-aprovados em `public/templates/` (submeter na WABA antes do disparo)
