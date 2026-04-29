import React, { useRef, useState } from "react";
import { parseCv } from "../api.js";

export default function Upload({ onParsed }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const handleParse = async () => {
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const resp = await parseCv(file);
      onParsed(resp);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Upload a candidate CV</h2>
      <p className="muted">
        Drop a PDF or Word CV below. Claude will extract the details, and you
        can review/edit before generating the formatted doc.
      </p>

      <div
        className={`dropzone ${drag ? "drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <div style={{ fontSize: 28 }}>📄</div>
        <div style={{ marginTop: 8 }}>
          <strong>Click to browse</strong> or drop a CV here
        </div>
        <div className="hint">PDF or Word (.docx / .doc)</div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {file && (
          <div className="file-chip">
            📎 {file.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              title="Remove"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {err && <div className="alert err">{err}</div>}

      <div style={{ marginTop: 20 }}>
        <button
          className="btn"
          disabled={!file || busy}
          onClick={handleParse}
        >
          {busy ? (
            <>
              <span className="spinner" /> Parsing with Claude…
            </>
          ) : (
            "Parse CV"
          )}
        </button>
      </div>
    </div>
  );
}
