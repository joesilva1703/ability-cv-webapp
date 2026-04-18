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
  return res.json();
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
  const cd = res.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match ? match[1] : "CV.docx";
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
