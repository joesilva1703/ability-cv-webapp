# Ability CV Formatter – Web App

A hosted version of the Ability Group CV reformatting tool. Consultants log in
via email (invite-only), upload a candidate CV, review what Claude extracted,
and download the formatted Word doc.

## Architecture

- **Frontend** – React app hosted on **Netlify**. Handles login via Netlify
  Identity and talks to the API.
- **Backend** – FastAPI service hosted on **Render** (free tier is fine for 2–5
  users). Does the PDF text extraction, calls Claude, and fills the Word
  template.

Netlify doesn't run Python, which is why the backend lives on Render. The user
only ever sees the Netlify URL (e.g. `https://ability-cv.netlify.app`). The
frontend calls the Render API in the background.

```
┌────────────────────────┐          ┌────────────────────────┐
│   Netlify (frontend)   │  HTTPS   │   Render (backend)     │
│   - React UI           │ ───────▶│   - FastAPI            │
│   - Netlify Identity   │  JWT    │   - Claude API         │
└────────────────────────┘          │   - python-docx        │
                                    └────────────────────────┘
```

---

## 1. One-time setup (≈ 30 minutes)

### 1.1 Put the code on GitHub

1. Create a new private GitHub repo called `ability-cv-webapp` (or similar).
2. Upload the contents of this folder to it (`frontend/`, `backend/`,
   `netlify.toml`, `render.yaml`, etc.).

### 1.2 Deploy the backend on Render

1. Sign up at https://render.com with your GitHub account.
2. Click **New → Blueprint** and pick the repo. Render will detect
   `render.yaml` and propose creating the `ability-cv-api` service — accept.
3. Before the first deploy, set these env vars in the Render dashboard (they
   are marked `sync: false` in the blueprint):
   - `ANTHROPIC_API_KEY` – your Claude key (from console.anthropic.com).
   - `ALLOWED_ORIGINS` – leave empty for now; we'll fill it in after Netlify.
   - `NETLIFY_SITE_URL` – leave empty for now.
   - `NETLIFY_JWT_SECRET` – leave empty for now (optional anyway).
4. Hit **Deploy**. Once it's live, copy the Render URL
   (e.g. `https://ability-cv-api.onrender.com`). Visit `/api/health` to
   sanity-check — should return `{"status": "ok", ...}`.

### 1.3 Deploy the frontend on Netlify

1. Sign up at https://netlify.com with your GitHub account.
2. Click **Add new site → Import an existing project** and pick the repo.
3. Netlify auto-detects `netlify.toml`, so just hit **Deploy**.
4. Once it's live, copy your Netlify URL (e.g. `https://ability-cv.netlify.app`).
5. In **Site settings → Environment variables**, add:
   - `VITE_API_BASE` = the Render URL from step 1.2 (e.g.
     `https://ability-cv-api.onrender.com`).
6. Click **Deploys → Trigger deploy → Deploy site** to rebuild with the env
   var.

### 1.4 Turn on Netlify Identity (login)

1. In your Netlify site, go to **Integrations → Identity** (or the old
   **Identity** tab) and click **Enable**.
2. In **Identity settings → Registration preferences**, choose
   **Invite only** (so only people Joe invites can sign in).
3. Back in **Identity → Users**, click **Invite users** and add the
   consultants' email addresses. They'll receive a setup link.

### 1.5 Tell the backend about the frontend

Back in Render, set these env vars (from step 1.2):
- `ALLOWED_ORIGINS` = your Netlify URL (e.g. `https://ability-cv.netlify.app`).
- `NETLIFY_SITE_URL` = same Netlify URL.

Hit **Manual Deploy → Clear build cache & deploy** to apply.

That's it. Go to your Netlify URL, sign in with the invite, and the full flow
should work.

---

## 2. Adding / removing consultants

Netlify → your site → **Identity → Users**. Invite by email, or delete a user
to revoke access.

---

## 3. Updating the app

Push to GitHub. Both Netlify and Render rebuild on every push to the main
branch.

---

## 4. Local development

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
export REQUIRE_AUTH=0         # skip JWT checks locally
export ALLOWED_ORIGINS=http://localhost:5173
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
# edit .env.local if needed: VITE_API_BASE=http://localhost:8000
npm install
npm run dev
```

Open http://localhost:5173. With `REQUIRE_AUTH=0`, the login step is still
shown but you can click through after a fake "sign in" (or temporarily edit
`App.jsx` to skip the gate).

---

## 5. Costs (typical)

| Service | Plan | Monthly |
|---------|------|---------|
| Netlify | Starter (free) | $0 |
| Render  | Free tier | $0 (spins down after 15 min idle; ~30s cold start) |
| Render  | Starter | $7 (no cold starts — recommended once the team uses it daily) |
| Claude API | pay-as-you-go | ~$0.02–0.05 per CV |

Upgrading Render to the Starter plan is usually worth it once the tool is in
daily use — otherwise consultants hit a 30-second wait on the first upload
of the day.

---

## 6. OneDrive auto-save (future)

v1 of the app downloads the CV to the consultant's Downloads folder. They then
drop it into the OneDrive `Claude AI CVs` folder. This is deliberate — it
avoids a Microsoft Graph / OAuth integration.

To add auto-save later, you'd register an Azure AD app with
`Files.ReadWrite.All` delegated permission and extend the `/api/generate`
endpoint to PUT the bytes to the SharePoint drive via Microsoft Graph.
