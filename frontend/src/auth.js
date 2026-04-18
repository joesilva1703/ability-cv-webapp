// Thin wrapper around Netlify Identity widget.
// Exposes: getUser(), onChange(cb), login(), logout(), token().

let listeners = new Set();
let cachedUser = null;

function _identity() {
  return typeof window !== "undefined" ? window.netlifyIdentity : null;
}

export function initAuth() {
  const id = _identity();
  if (!id) return;
  id.on("init", (user) => {
    cachedUser = user;
    listeners.forEach((cb) => cb(user));
  });
  id.on("login", (user) => {
    cachedUser = user;
    id.close();
    listeners.forEach((cb) => cb(user));
  });
  id.on("logout", () => {
    cachedUser = null;
    listeners.forEach((cb) => cb(null));
  });
  id.init();
}

export function getUser() {
  return cachedUser;
}

export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function login() {
  const id = _identity();
  if (id) id.open("login");
}

export function logout() {
  const id = _identity();
  if (id) id.logout();
}

// Fetch a fresh JWT (auto-refreshes if near expiry).
export async function token() {
  const id = _identity();
  const user = id?.currentUser();
  if (!user) return null;
  try {
    return await user.jwt();
  } catch {
    return null;
  }
}
