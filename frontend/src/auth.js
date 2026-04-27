// Auth wrapper around Supabase Auth.
//
// Exposes the same shape the rest of the app already uses:
//   initAuth()                 — kick off session bootstrap & subscribe to changes
//   getUser()                  — current user (null when signed out)
//   onChange(cb)               — subscribe to user changes; returns unsubscribe
//   login(email)               — send a magic-link sign-in email; returns
//                                {ok, error}
//   logout()                   — sign out
//   token()                    — fresh JWT (auto-refreshes), or null
//
// Login flow: invite-only magic links. The user types their email, clicks
// "Send link", receives an email, clicks the link, and lands back on the app
// authenticated. No passwords to manage.

import { supabase, isConfigured } from "./supabase.js";

let listeners = new Set();
let cachedUser = null;
let initDone = false;
let initCalled = false;

function _notify(user) {
  cachedUser = user ?? null;
  initDone = true;
  listeners.forEach((cb) => cb(cachedUser));
}

export function initAuth() {
  if (initCalled) return;
  initCalled = true;

  if (!isConfigured) {
    // Provider not configured — surface a null user so the UI shows the login
    // screen instead of hanging on "Loading…".
    _notify(null);
    return;
  }

  // Hydrate current session synchronously, then subscribe to future changes.
  supabase.auth.getSession().then(({ data }) => {
    _notify(data.session?.user ?? null);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    _notify(session?.user ?? null);
  });
}

export function getUser() {
  return cachedUser;
}

export function onChange(cb) {
  listeners.add(cb);
  if (initDone) cb(cachedUser);
  return () => listeners.delete(cb);
}

/**
 * Send a magic link to `email`. The user clicks the link in their inbox to
 * complete sign-in.
 *
 * @param {string} email
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function login(email) {
  if (!isConfigured) {
    return { ok: false, error: "Auth is not configured (Supabase env vars missing)." };
  }
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Send the user back to the app after they click the link.
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logout() {
  if (!isConfigured) return;
  await supabase.auth.signOut();
}

// Fetch a fresh JWT (auto-refreshes if near expiry).
export async function token() {
  if (!isConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
