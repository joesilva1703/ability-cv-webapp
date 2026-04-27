import React, { useEffect, useState } from "react";
import { getUser, initAuth, login, logout, onChange } from "./auth.js";
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
    return off;
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

  if (!user) return <LoginGate />;

  return (
    <Shell user={user}>
      {step === "upload" && (
        <Upload defaultIntroducer={defaultIntroducer} onParsed={onParsed} />
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
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    const result = await login(email);
    if (result.ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setErrorMsg(result.error || "Something went wrong.");
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
          <p>
            Enter the email address Joe invited you with. We'll send you a
            one-time sign-in link.
          </p>
          {status === "sent" ? (
            <p>
              ✓ Check your inbox — we sent a sign-in link to{" "}
              <strong>{email}</strong>. Click it to come back here signed in.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="login-form">
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={status === "sending"}
              />
              <button
                className="btn"
                type="submit"
                disabled={status === "sending"}
              >
                {status === "sending" ? "Sending…" : "Send sign-in link"}
              </button>
              {status === "error" && (
                <p className="error">{errorMsg}</p>
              )}
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
