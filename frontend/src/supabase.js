// Single Supabase client instance for the app. Reads project URL + anon key
// from Vite env vars (must be exposed with the VITE_ prefix at build time).
//
// The anon key is safe to ship to the browser — it's the public, low-privilege
// key. The signing secret stays on the server.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Don't throw — let the auth layer fall through to a "no provider configured"
  // state so the UI can render an informative login screen rather than a blank
  // page on misconfigured deploys.
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase env vars missing: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY"
  );
}

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const isConfigured = Boolean(supabase);
