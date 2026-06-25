# Chronos — Cloud backend setup (Supabase)

Chronos is local-first; cloud sync is **optional**. With a Supabase project connected,
your schedule (and, once Phase C lands, your learning profile, chat history, digests…)
sync across devices. There are two ways to connect:

- **Hosted (recommended for a deploy):** set env vars at build time → every visitor uses
  your project.
- **BYO (bring your own):** a user pastes their own project URL + anon key in **Settings →
  Cloud Sync**. A BYO config overrides the hosted env project on that device.

> **Security:** only the project **URL** and the **anon** key are client-safe (they're
> protected by Row-Level Security). **Never** put the `service_role` key or the VAPID
> **private** key in a `VITE_*` var — those go only in Supabase Edge Function secrets.

## 1. Create the project & schema
1. Create a project at <https://supabase.com>.
2. Apply the schema — either:
   - **SQL editor:** paste `supabase/migrations/0001_init.sql` and run; **or**
   - **CLI:** `supabase link --project-ref <ref>` then `supabase db push`.
3. **Auth → Providers:** enable **Email**. (The app uses email/password with
   auto-sign-up on first login; for a real deploy, consider turning on email confirmation.)

The migration creates two RLS-protected tables:
- `user_data (user_id, key, value jsonb, version, updated_at)` — one row per (user, domain).
- `push_subscriptions (user_id, endpoint, subscription jsonb, created_at)` — for push.

## 2. Connect the app
- **Hosted:** set these in your host's build env (Vercel/Cloudflare Pages) and rebuild:
  ```
  VITE_SUPABASE_URL=https://<ref>.supabase.co
  VITE_SUPABASE_ANON_KEY=<anon public key>
  ```
- **BYO:** in the app, go to **Settings → Cloud Sync**, paste the URL + anon key, reload.

Then **sign in** (Login page, email/password) — the schedule repository switches to the
cloud once you have a session.

## 3. Verify
- **RLS:** in the SQL editor as user A, `select * from user_data;` returns only A's rows.
  Create a second user; confirm neither can read the other's rows.
- **Sync:** edit the schedule on browser A → reload browser B (same account) → changes appear.
  (Live convergence without reload arrives with Phase D / realtime.)

## 4. Push notifications (Phase E — later)
1. Generate VAPID keys (`npx web-push generate-vapid-keys`).
2. Client: set `VITE_VAPID_PUBLIC_KEY` (public key is client-safe).
3. Edge Function `notify`: store the VAPID **private** key + a `service_role` client as
   **function secrets** (`supabase secrets set ...`), schedule it with Supabase cron, and
   have it read upcoming blocks from `user_data` and Web Push to `push_subscriptions`.

## Deploy notes
The entire backend (DB, auth, realtime, Edge Functions, cron) is Supabase, so the static
host only serves the SPA. **Vercel** (zero-config SPA rewrites) or **Cloudflare Pages**
(add `public/_redirects` → `/* /index.html 200`) both work. Set the two `VITE_SUPABASE_*`
vars in the host's build env; keep all secrets in Supabase.
