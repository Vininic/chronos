# Chronos — Cloud backend setup (Supabase)

Chronos is local-first; the backend is **optional**. With a Supabase project connected,
a signed-in account syncs its schedule **and** its learning profile, chat history,
digests, and settings across devices — and you can offer a working hosted AI without
shipping an API key in the bundle. There are two ways to connect:

- **Hosted (recommended for a deploy):** set env vars at build time → every visitor uses
  your project.
- **BYO (bring your own):** a user pastes their own project URL + anon key in **Settings →
  Cloud Sync**. A BYO config overrides the hosted env project on that device.

> **Security:** only the project **URL** and the **anon** key are client-safe (they're
> protected by Row-Level Security). **Never** put the `service_role` key, the
> `GEMINI_API_KEY`, or the VAPID **private** key in a `VITE_*` var — those are inlined into
> the bundle. They belong only in Supabase Edge Function secrets.

## 1. Create the project & schema
1. Create a project at <https://supabase.com>.
2. Apply the migrations — either:
   - **SQL editor:** paste and run `supabase/migrations/0001_init.sql`, then `0002_ai_proxy.sql`; **or**
   - **CLI:** `supabase link --project-ref <ref>` then `supabase db push`.
3. **Auth → Providers:** enable **Email**. (The app uses email/password with
   auto-sign-up on first login; for a real deploy, consider turning on email confirmation.)

The migrations create:
- `user_data (user_id, key, value jsonb, version, updated_at)` — one RLS-protected row per (user, domain).
- `push_subscriptions (user_id, endpoint, subscription jsonb, created_at)` — for Web Push.
- `ai_proxy_rate_limit` + `bump_ai_proxy_rate()` — per-IP cost guard for the hosted AI proxy.

## 2. Connect the app
- **Hosted:** set these in your host's build env (Vercel/Cloudflare Pages) and rebuild:
  ```
  VITE_SUPABASE_URL=https://<ref>.supabase.co
  VITE_SUPABASE_ANON_KEY=<anon public key>
  ```
- **BYO:** in the app, go to **Settings → Cloud Sync**, paste the URL + anon key, reload.

On the **Login** page there are now two profiles:
- **Guest** — just a name; data stays in this browser (local repository, no sync).
- **Cloud account** — email/password; the schedule + other stores switch to the cloud
  repository and sync. Only a signed-in (email) account uses the cloud.

## 3. Verify
- **RLS:** in the SQL editor as user A, `select * from user_data;` returns only A's rows.
  Create a second user; confirm neither can read the other's rows.
- **Sync:** sign in on browsers A and B (same account); edit on A → B shows a "Updated on
  another device" toast (realtime) and pulls on reload.

## 4. Hosted AI proxy (`ai-proxy`)
Lets the deployed demo use Gemini without exposing a key. The browser calls the Edge
Function; the function holds the key as a **server secret** and calls Google.

```bash
supabase functions deploy ai-proxy
supabase secrets set GEMINI_API_KEY=AIza...           # your Google AI Studio key
supabase secrets set ALLOWED_ORIGIN=https://your-app.example   # optional: restrict callers
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. With this
deployed, the default **Gemini (Hosted)** provider works for every visitor; per-IP rate
limiting (default 30/min, via `0002`) caps cost. Without it, the app falls back to BYO
keys and an honest "add an API key" state.

## 5. Push notifications (`notify`)
1. Generate VAPID keys (`npx web-push generate-vapid-keys`).
2. Client: set `VITE_VAPID_PUBLIC_KEY` (public key is client-safe).
3. Edge Function `notify`: set the VAPID **private** key as a function secret, schedule it
   with Supabase cron, and have it read upcoming blocks from `user_data` and Web Push to
   `push_subscriptions`. ⚠️ It currently assumes UTC — store each user's IANA timezone for
   correct reminder timing.

## Deploy notes
The entire backend (DB, auth, realtime, Edge Functions, cron) is Supabase, so the static
host only serves the SPA. **Vercel** (zero-config SPA rewrites) or **Cloudflare Pages**
(add `public/_redirects` → `/* /index.html 200`) both work. Set the two `VITE_SUPABASE_*`
vars in the host's build env; keep all secrets in Supabase.
