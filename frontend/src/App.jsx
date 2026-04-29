import React, { useEffect, useState } from "react";
import {
  getUser,
  initAuth,
  login,
  logout,
  onChange,
  onPasswordRecovery,
  sendPasswordReset,
  updatePassword,
} from "./auth.js";
import Upload from "./screens/Upload.jsx";
import Edit from "./screens/Edit.jsx";
import Done from "./screens/Done.jsx";

const DEFAULT_INTRODUCER = {
  name: "Joe",
  phone: "010 593 4900",
  email: "joe@abilitygroup.co.za",
};

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [step, setStep] = useState("upload"); // upload | edit | done
  const [data, setData] = useState(null);
  const [defaultIntroducer, setDefaultIntroducer] = useState(DEFAULT_INTRODUCER);
  const [output, setOutput] = useState(null); // { blob, filename }

  useEffect(() => {
    initAuth();
    const off = onChange((u) => {
      setUser(u);
      setReady(true);
    });
    const offRecovery = onPasswordRecovery(() => setRecovering(true));
    return () => {
      off();
      offRecovery();
    };
  }, []);

  const reset = () => {
    setStep("upload");
    setData(null);
    setOutput(null);
  };

  const onParsed = (resp) => {
    setData(resp.data);
    if (resp.default_introducer) setDefaultIntroducer(resp.default_introducer);
    setStep("edit");
  };

  const onGenerated = (result) => {
    setOutput(result);
    setStep("done");
  };

  if (!ready) {
    return <Shell user={null}><div className="card">Loading…</div></Shell>;
  }

  if (recovering) {
    return <SetNewPasswordGate onDone={() => setRecovering(false)} />;
  }

  if (!user) return <LoginGate />;

  return (
    <Shell user={user}>
      {step === "upload" && (
        <Upload onParsed={onParsed} />
      )}
      {step === "edit" && (
        <Edit
          data={data}
          setData={setData}
          defaultIntroducer={defaultIntroducer}
          onBack={reset}
          onGenerated={onGenerated}
        />
      )}
      {step === "done" && (
        <Done output={output} onAnother={reset} onBack={() => setStep("edit")} />
      )}
    </Shell>
  );
}

function Shell({ user, children }) {
  return (
    <div className="app-shell">
      <header className="header">
        <h1>Ability CV Builder</h1>
        {user && (
          <div className="user">
            <span>{user.email}</span>
            <button onClick={logout}>Log out</button>
          </div>
        )}
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

function LoginGate() {
  const [mode, setMode] = useState("signin"); // signin | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  const onSignIn = async (e) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");
    const result = await login(email, password);
    if (!result.ok) {
      setStatus("error");
      setErrorMsg(result.error || "Sign-in failed.");
    }
    // On success, the auth state listener swaps the UI; nothing to do here.
  };

  const onForgot = async (e) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");
    const result = await sendPasswordReset(email);
    if (result.ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setErrorMsg(result.error || "Could not send reset email.");
    }
  };

  return (
    <div className="app-shell">
      <header className="header">
        <h1>Ability CV Builder</h1>
      </header>
      <main className="main">
        <div className="login-card">
          <h2>Welcome</h2>
          {mode === "signin" && (
            <>
              <p>Sign in with the email address Joe invited you with.</p>
              <form onSubmit={onSignIn} className="login-form">
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={status === "submitting"}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={status === "submitting"}
                />
                <button
                  className="btn"
                  type="submit"
                  disabled={status === "submitting"}
                >
                  {status === "submitting" ? "Signing in…" : "Sign in"}
                </button>
                {status === "error" && <p className="error">{errorMsg}</p>}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setMode("forgot");
                    setStatus("idle");
                    setErrorMsg("");
                  }}
                >
                  Forgot password?
                </button>
              </form>
            </>
          )}
          {mode === "forgot" && (
            <>
              {status === "sent" ? (
                <p>
                  ✓ If an account exists for <strong>{email}</strong>, a reset
                  link is on its way. Click it to set a new password.
                </p>
              ) : (
                <>
                  <p>
                    Enter your email and we'll send you a link to reset your
                    password.
                  </p>
                  <form onSubmit={onForgot} className="login-form">
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      disabled={status === "submitting"}
                    />
                    <button
                      className="btn"
                      type="submit"
                      disabled={status === "submitting"}
                    >
                      {status === "submitting" ? "Sending…" : "Send reset link"}
                    </button>
                    {status === "error" && <p className="error">{errorMsg}</p>}
                  </form>
                </>
              )}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setMode("signin");
                  setStatus("idle");
                  setErrorMsg("");
                }}
              >
                ← Back to sign in
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function SetNewPasswordGate({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | error
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (password !== confirm) {
      setStatus("error");
      setErrorMsg("Passwords don't match.");
      return;
    }
    setStatus("submitting");
    const result = await updatePassword(password);
    if (result.ok) {
      onDone();
    } else {
      setStatus("error");
      setErrorMsg(result.error || "Could not update password.");
    }
  };

  return (
    <div className="app-shell">
      <header className="header">
        <h1>Ability CV Builder</h1>
      </header>
      <main className="main">
        <div className="login-card">
          <h2>Set a new password</h2>
          <p>Choose a password you'll remember — at least 8 characters.</p>
          <form onSubmit={onSubmit} className="login-form">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              disabled={status === "submitting"}
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              disabled={status === "submitting"}
            />
            <button
              className="btn"
              type="submit"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? "Saving…" : "Save password"}
            </button>
            {status === "error" && <p className="error">{errorMsg}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}
