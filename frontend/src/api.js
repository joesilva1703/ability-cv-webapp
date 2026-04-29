import { token } from "./auth.js";

const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_BASE) || "";

async function authHeaders() {
  const t = await token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function parseCv(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/parse`, {
    method: "POST",
    headers: { ...(await authHeaders()) },
    body: fd,
  });
  if (!res.ok) throw new Error(await _error(res));
  // Read as text first so we can surface the actual body on a JSON parse
  // failure — otherwise the user sees a bare "Unexpected token" with no
  // indication of what the server sent back (truncated JSON, HTML error
  // page, etc.).
  const body = await res.text();
  try {
    return JSON.parse(body);
  } catch (e) {
    const snippet = body.slice(0, 300).replace(/\s+/g, " ");
    throw new Error(
      `Server returned a response that isn't valid JSON. First 300 chars: ${snippet}`
    );
  }
}

export async function generateCv(payload) {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await _error(res));
  const blob = await res.blob();
  // Try Content-Disposition first, fall back to the custom X-Ability-Filename
  // header in case the browser hides Content-Disposition from JS for any
  // reason. Last-ditch fallback uses the candidate's name from the payload.
  const cd = res.headers.get("Content-Disposition") || "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const headerName =
    res.headers.get("X-Ability-Filename") || (match ? match[1] : "");
  const candidateName = payload?.data?.candidate?.name?.trim();
  const fallback = candidateName ? `${candidateName}.docx` : "CV.docx";
  const filename = (headerName || fallback).trim();
  return { blob, filename };
}

async function _error(res) {
  const ct = res.headers.get("Content-Type") || "";
  if (ct.includes("application/json")) {
    try {
      const data = await res.json();
      return data.detail || JSON.stringify(data);
    } catch {
      /* fall through */
    }
  }
  return (await res.text()) || `Request failed (${res.status})`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
