/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Default (hosted) Supabase project — inlined at build time. Safe to expose. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Optional default Gemini key for local dev (see settings/store.ts). */
  readonly VITE_GEMINI_API_KEY?: string;
  /** Web Push VAPID PUBLIC key (the private key lives only in the Edge Function). */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
