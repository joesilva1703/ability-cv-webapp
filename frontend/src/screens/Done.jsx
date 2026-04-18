import React, { useEffect } from "react";
import { downloadBlob } from "../api.js";

export default function Done({ output, onAnother, onBack }) {
  useEffect(() => {
    // Auto-trigger download once.
    if (output?.blob && output?.filename) {
      downloadBlob(output.blob, output.filename);
    }
    // eslint-disable-next-line
  }, []);

  return (
    <div className="card">
      <h2>✅ Done</h2>
      <p className="muted">
        <strong>{output?.filename || "CV.docx"}</strong> has been downloaded.
      </p>
      <div className="alert info">
        Drop the file into your OneDrive{" "}
        <span className="kbd">Claude AI CVs</span> folder to share with the
        team.
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="btn ghost"
          onClick={() =>
            output?.blob && downloadBlob(output.blob, output.filename)
          }
        >
          ⬇ Download again
        </button>
        <button className="btn subtle" onClick={onBack}>
          ✏ Back to edit
        </button>
        <button className="btn" onClick={onAnother}>
          ➕ Format another CV
        </button>
      </div>
    </div>
  );
}
