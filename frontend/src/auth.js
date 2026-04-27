// Auth wrapper around Supabase Auth — email + password sign-in.
//
// Exposes:
//   initAuth()                   — bootstrap session & subscribe to changes
//   getUser()                    — current user (null when signed out)
//   onChange(cb)                 — subscribe to user changes; returns unsubscribe
//   onPasswordRecovery(cb)       — fires when user lands via password-reset link;
//                                  caller should show a "set new password" UI
//   login(email, password)       — sign in; returns {ok, error}
//   logout()                     — sign out
//   token()                      — fresh JWT (auto-refreshes), or null
//   sendPasswordReset(email)     — send password-reset email; {ok, error}
//   updatePassword(newPassword)  — set a new password; {ok, error}

import { supabase, isConfigured } from "./supabase.js";

let listeners = new Set();
let recoveryListeners = new Set();
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
    _notify(null);
    return;
  }

  supabase.auth.getSession().then(({ data }) => {
    _notify(data.session?.user ?? null);
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      // User clicked a recovery link. Tell the UI to prompt for a new password.
      // We still mark the session as active so the user is "signed in" for the
      // duration of the recovery flow.
      _notify(session?.user ?? null);
      recoveryListeners.forEach((cb) => cb());
      return;
    }
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

export function onPasswordRecovery(cb) {
  recoveryListeners.add(cb);
  return () => recoveryListeners.delete(cb);
}

export async function login(email, password) {
  if (!isConfigured) {
    return { ok: false, error: "Auth is not configured (Supabase env vars missing)." };
  }
  if (!email || !password) {
    return { ok: false, error: "Please enter your email and password." };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logout() {
  if (!isConfigured) return;
  await supabase.auth.signOut();
}

export async function token() {
  if (!isConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function sendPasswordReset(email) {
  if (!isConfigured) {
    return { ok: false, error: "Auth is not configured." };
  }
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updatePassword(newPassword) {
  if (!isConfigured) {
    return { ok: false, error: "Auth is not configured." };
  }
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
