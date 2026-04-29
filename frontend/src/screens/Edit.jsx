import React, { useMemo, useState } from "react";
import { generateCv } from "../api.js";

/* ------------------------------------------------------------------------- */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------- */

const TABS = [
  "Introducer",
  "Summary",
  "Personal info",
  "Work experience",
  "Education",
  "Skills",
];

function useField(data, setData, path) {
  return (value) => {
    setData((prev) => setPath(prev, path, value));
  };
}

function setPath(obj, path, value) {
  const keys = Array.isArray(path) ? path : path.split(".");
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  let cursor = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const next = cursor[k];
    cursor[k] =
      next === undefined || next === null
        ? typeof keys[i + 1] === "number"
          ? []
          : {}
        : Array.isArray(next)
        ? [...next]
        : { ...next };
    cursor = cursor[k];
  }
  cursor[keys[keys.length - 1]] = value;
  return clone;
}

function linesToList(text) {
  return (text || "")
    .split("\n")
    .map((ln) => ln.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------------- */
/* Edit                                                                      */
/* ------------------------------------------------------------------------- */

export default function Edit({
  data,
  setData,
  defaultIntroducer,
  onBack,
  onGenerated,
}) {
  const [tab, setTab] = useState("Introducer");
  const [introducer, setIntroducer] = useState(defaultIntroducer);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const cand = data?.candidate || {};
  const name = cand.name || "Unknown candidate";

  const handleGenerate = async () => {
    if (!cand.name) {
      setErr("Please fill in the candidate's name before generating.");
      setTab("Personal info");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const payload = {
        data,
        introducer_override: introducer,
      };
      const result = await generateCv(payload);
      onGenerated(result);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <h2 style={{ margin: 0 }}>Review: {name}</h2>
        <button className="btn subtle" onClick={onBack}>
          ⬅ Start over
        </button>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        Anything left blank shows in the final CV as a yellow-highlighted{" "}
        <span className="kbd">TBC</span>. Edit freely — Claude's extraction
        isn't always perfect.
      </p>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === "Summary" && (
          <SummaryTab data={data} setData={setData} />
        )}
        {tab === "Personal info" && (
          <PersonalInfoTab data={data} setData={setData} />
        )}
        {tab === "Introducer" && (
          <IntroducerTab
            introducer={introducer}
            setIntroducer={setIntroducer}
          />
        )}
        {tab === "Work experience" && (
          <WorkTab data={data} setData={setData} />
        )}
        {tab === "Education" && (
          <EducationTab data={data} setData={setData} />
        )}
        {tab === "Skills" && <SkillsTab data={data} setData={setData} />}
      </div>

      {err && <div className="alert err">{err}</div>}

      <div className="footer-actions">
        <div className="muted" style={{ fontSize: 13 }}>
          {data.work_experience?.length || 0} role
          {(data.work_experience?.length || 0) === 1 ? "" : "s"} ·{" "}
          {data.skills?.length || 0} skills
        </div>
        <button className="btn" onClick={handleGenerate} disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" /> Generating…
            </>
          ) : (
            "🪄 Generate formatted CV"
          )}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Tabs                                                                      */
/* ------------------------------------------------------------------------- */

function SummaryTab({ data, setData }) {
  const summary = data.summary || { paragraph: "", bullets: [] };
  const setPara = useField(data, setData, "summary.paragraph");
  const setBullets = (text) =>
    setData((prev) => setPath(prev, "summary.bullets", linesToList(text)));

  return (
    <>
      <Field
        label="Candidate summary paragraph"
        hint="2–4 sentence narrative for the hiring manager."
      >
        <textarea
          value={summary.paragraph || ""}
          onChange={(e) => setPara(e.target.value)}
          rows={4}
        />
      </Field>
      <Field
        label="Summary bullets"
        hint="One per line. 3–5 recommended."
      >
        <textarea
          value={(summary.bullets || []).join("\n")}
          onChange={(e) => setBullets(e.target.value)}
          rows={6}
        />
      </Field>
    </>
  );
}

function PersonalInfoTab({ data, setData }) {
  const cand = data.candidate || {};
  const set = (k) => (v) =>
    setData((prev) => setPath(prev, ["candidate", k], v));
  return (
    <div className="grid-2">
      <div>
        <Field label="Full name *">
          <input
            value={cand.name || ""}
            onChange={(e) => set("name")(e.target.value)}
          />
        </Field>
        <Field
          label="Position submitted for"
          hint="Usually taken from the current role."
        >
          <input
            value={cand.position || ""}
            onChange={(e) => set("position")(e.target.value)}
          />
        </Field>
        <Field label="Location">
          <input
            value={cand.location || ""}
            onChange={(e) => set("location")(e.target.value)}
          />
        </Field>
        <Field label="EE / Gender" hint="e.g. African Female. Leave blank → TBC.">
          <input
            value={cand.ee_gender || ""}
            onChange={(e) => set("ee_gender")(e.target.value)}
          />
        </Field>
        <Field label="Nationality">
          <input
            value={cand.nationality || ""}
            onChange={(e) => set("nationality")(e.target.value)}
          />
        </Field>
      </div>
      <div>
        <Field label="Availability" hint="e.g. 1 Calendar Month">
          <input
            value={cand.availability || ""}
            onChange={(e) => set("availability")(e.target.value)}
          />
        </Field>
        <Field label="Current salary" hint="e.g. R58 000 p/m CTC">
          <input
            value={cand.current_salary || ""}
            onChange={(e) => set("current_salary")(e.target.value)}
          />
        </Field>
        <Field label="Expected salary" hint="e.g. R72 000 p/m CTC">
          <input
            value={cand.expected_salary || ""}
            onChange={(e) => set("expected_salary")(e.target.value)}
          />
        </Field>
        <Field label="ID number">
          <input
            value={cand.id_number || ""}
            onChange={(e) => set("id_number")(e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function IntroducerTab({ introducer, setIntroducer }) {
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        These details appear on the "INTRODUCED BY" line at the top of the
        generated CV.
      </p>
      <div className="grid-2">
        <Field label="Name of Recruiter">
          <input
            value={introducer.name || ""}
            onChange={(e) =>
              setIntroducer((p) => ({ ...p, name: e.target.value }))
            }
          />
        </Field>
        <Field label="Contact Number">
          <input
            value={introducer.phone || ""}
            onChange={(e) =>
              setIntroducer((p) => ({ ...p, phone: e.target.value }))
            }
          />
        </Field>
        <Field label="Email Address">
          <input
            value={introducer.email || ""}
            onChange={(e) =>
              setIntroducer((p) => ({ ...p, email: e.target.value }))
            }
          />
        </Field>
      </div>
    </>
  );
}

function WorkTab({ data, setData }) {
  const jobs = data.work_experience || [];

  const update = (idx, key, value) =>
    setData((prev) => {
      const next = { ...prev, work_experience: [...prev.work_experience] };
      next.work_experience[idx] = { ...next.work_experience[idx], [key]: value };
      // Mirror into work_summary so the short table stays in sync.
      next.work_summary = next.work_experience.map((j) => ({
        company: j.company || "",
        position: j.position || "",
        dates: j.dates || "",
      }));
      return next;
    });

  const setDuties = (idx, text) => update(idx, "duties", linesToList(text));

  const remove = (idx) =>
    setData((prev) => {
      const next = prev.work_experience.filter((_, i) => i !== idx);
      return {
        ...prev,
        work_experience: next,
        work_summary: next.map((j) => ({
          company: j.company || "",
          position: j.position || "",
          dates: j.dates || "",
        })),
      };
    });

  const add = () =>
    setData((prev) => ({
      ...prev,
      work_experience: [
        ...(prev.work_experience || []),
        {
          company: "",
          position: "",
          dates: "",
          duties: [],
          reason_for_leaving: "",
        },
      ],
    }));

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Reverse-chronological (most recent first). The "Work Summary" table
        updates automatically.
      </p>

      {jobs.map((job, idx) => (
        <details className="job-card" key={idx} open={idx === 0}>
          <summary>
            <span>
              {idx + 1}. {job.position || "Role"} ·{" "}
              {job.company || "Company"} · {job.dates || "Dates"}
            </span>
            <span className="chev">▸</span>
          </summary>
          <div className="inner">
            <div className="grid-2">
              <Field label="Company">
                <input
                  value={job.company || ""}
                  onChange={(e) => update(idx, "company", e.target.value)}
                />
              </Field>
              <Field label="Position">
                <input
                  value={job.position || ""}
                  onChange={(e) => update(idx, "position", e.target.value)}
                />
              </Field>
              <Field label="Dates" hint="e.g. July 2020 – July 2025">
                <input
                  value={job.dates || ""}
                  onChange={(e) => update(idx, "dates", e.target.value)}
                />
              </Field>
              <Field label="Reason for leaving">
                <input
                  value={job.reason_for_leaving || ""}
                  onChange={(e) =>
                    update(idx, "reason_for_leaving", e.target.value)
                  }
                />
              </Field>
            </div>
            <Field label="Duties" hint="One per line.">
              <textarea
                rows={7}
                value={(job.duties || []).join("\n")}
                onChange={(e) => setDuties(idx, e.target.value)}
              />
            </Field>
            <button className="btn danger" onClick={() => remove(idx)}>
              🗑 Remove this role
            </button>
          </div>
        </details>
      ))}

      <button className="btn ghost" onClick={add} style={{ marginTop: 8 }}>
        ➕ Add a role
      </button>
    </>
  );
}

function EducationTab({ data, setData }) {
  const school = data.school || { name: null, date: null, matric: null };
  const setSchool = (k) => (v) =>
    setData((prev) => setPath(prev, ["school", k], v));

  const tertiary = data.tertiary || [];
  const updateTert = (idx, key, value) =>
    setData((prev) => {
      const next = [...(prev.tertiary || [])];
      next[idx] = { ...next[idx], [key]: value };
      return { ...prev, tertiary: next };
    });
  const removeTert = (idx) =>
    setData((prev) => ({
      ...prev,
      tertiary: (prev.tertiary || []).filter((_, i) => i !== idx),
    }));
  const addTert = () =>
    setData((prev) => ({
      ...prev,
      tertiary: [
        ...(prev.tertiary || []),
        { institution: "", date: "", qualification: "" },
      ],
    }));

  const memberships = (data.memberships || []).join("\n");
  const setMemberships = (text) =>
    setData((prev) => ({ ...prev, memberships: linesToList(text) }));

  return (
    <>
      <h3 style={{ marginTop: 0 }}>School (Matric)</h3>
      <div className="grid-2">
        <Field label="School name">
          <input
            value={school.name || ""}
            onChange={(e) => setSchool("name")(e.target.value)}
          />
        </Field>
        <Field label="Year matriculated">
          <input
            value={school.date || ""}
            onChange={(e) => setSchool("date")(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Matric qualification" hint="e.g. Grade 12 (Matric)">
        <input
          value={school.matric || ""}
          onChange={(e) => setSchool("matric")(e.target.value)}
        />
      </Field>

      <h3>Tertiary education</h3>
      {tertiary.map((row, idx) => (
        <div className="job-card" key={idx}>
          <div className="grid-2">
            <Field label="Institution">
              <input
                value={row.institution || ""}
                onChange={(e) => updateTert(idx, "institution", e.target.value)}
              />
            </Field>
            <Field label="Year">
              <input
                value={row.date || ""}
                onChange={(e) => updateTert(idx, "date", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Qualification">
            <input
              value={row.qualification || ""}
              onChange={(e) => updateTert(idx, "qualification", e.target.value)}
            />
          </Field>
          <button className="btn danger" onClick={() => removeTert(idx)}>
            🗑 Remove
          </button>
        </div>
      ))}
      <button className="btn ghost" onClick={addTert}>
        ➕ Add qualification
      </button>

      <h3 style={{ marginTop: 24 }}>Professional memberships</h3>
      <Field label="One per line">
        <textarea
          rows={4}
          value={memberships}
          onChange={(e) => setMemberships(e.target.value)}
        />
      </Field>
    </>
  );
}

function SkillsTab({ data, setData }) {
  const skills = (data.skills || []).join("\n");
  const computer = (data.computer_skills || []).join("\n");
  return (
    <div className="grid-2">
      <Field label="Skills" hint="One per line.">
        <textarea
          rows={12}
          value={skills}
          onChange={(e) =>
            setData((prev) => ({ ...prev, skills: linesToList(e.target.value) }))
          }
        />
      </Field>
      <Field label="Computer skills" hint="One per line.">
        <textarea
          rows={12}
          value={computer}
          onChange={(e) =>
            setData((prev) => ({
              ...prev,
              computer_skills: linesToList(e.target.value),
            }))
          }
        />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Field                                                                     */
/* ------------------------------------------------------------------------- */

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}
