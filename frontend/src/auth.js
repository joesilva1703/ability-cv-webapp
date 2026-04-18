// Thin wrapper around Netlify Identity widget.
// Exposes: getUser(), onChange(cb), login(), logout(), token().

let listeners = new Set();
let cachedUser = null;
let initDone = false;
let initCalled = false;

function _identity() {
  return typeof window !== "undefined" ? window.netlifyIdentity : null;
}

function _markInit(user) {
  cachedUser = user ?? null;
  initDone = true;
  listeners.forEach((cb) => cb(cachedUser));
}

export function initAuth() {
  if (initCalled) return;
  initCalled = true;

  const id = _identity();

  // Widget didn't load (network filter, CDN blocked, etc.) — unblock the UI
  // with a null user so the app shows its login screen instead of hanging.
  if (!id) {
    _markInit(null);
    return;
  }

  id.on("init", (user) => {
    _markInit(user);
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

  // If the widget has already initialised (e.g. it auto-inits on script load
  // and fired its "init" event before this module subscribed), pick up the
  // current state synchronously instead of waiting forever.
  const existing = id.currentUser();
  if (existing !== undefined) {
    _markInit(existing);
  }

  // Calling init() is safe even if it has already been called.
  id.init();
}

export function getUser() {
  return cachedUser;
}

export function onChange(cb) {
  listeners.add(cb);
  // Late subscriber — fire immediately with whatever we know so the caller
  // doesn't wait for an event that already happened.
  if (initDone) cb(cachedUser);
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
