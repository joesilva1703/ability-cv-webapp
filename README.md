# Ability CV Formatter – Web App

A hosted version of the Ability Group CV reformatting tool. Consultants log in
via email (invite-only), upload a candidate CV, review what Claude extracted,
and download the formatted Word doc.

## Architecture

- **Frontend** – React app hosted on **Vercel**. Handles login (auth provider
  TBD — see "Auth replacement" below) and talks to the API.
- **Backend** – FastAPI service hosted on **Render** (free tier is fine for 2–5
  users). Does the PDF text extraction, calls Claude, and fills the Word
  template.

Vercel doesn't run Python, which is why the backend lives on Render. The user
only ever sees the Vercel URL (e.g. `https://ability-cv.vercel.app`). The
frontend calls the Render API in the background.

```
┌────────────────────────┐          ┌────────────────────────┐
│   Vercel (frontend)    │  HTTPS   │   Render (backend)     │
│   - React UI           │ ───────▶│   - FastAPI            │
│   - Auth provider      │  JWT    │   - Claude API         │
└────────────────────────┘          │   - python-docx        │
                                    └────────────────────────┘
```

---

## 1. One-time setup (≈ 30 minutes)

### 1.1 Put the code on GitHub

1. Create a new private GitHub repo called `ability-cv-webapp` (or similar).
2. Upload the contents of this folder to it (`frontend/`, `backend/`,
   `vercel.json`, `render.yaml`, etc.).

### 1.2 Deploy the backend on Render

1. Sign up at https://render.com with your GitHub account.
2. Click **New → Blueprint** and pick the repo. Render will detect
   `render.yaml` and propose creating the `ability-cv-api` service — accept.
3. Before the first deploy, set these env vars in the Render dashboard (they
   are marked `sync: false` in the blueprint):
   - `ANTHROPIC_API_KEY` – your Claude key (from console.anthropic.com).
   - `ALLOWED_ORIGINS` – leave empty for now; we'll fill it in after Vercel.
   - `JWT_ISSUER` – leave empty for now; depends on chosen auth provider.
   - `JWT_SECRET` – leave empty for now (optional, enables signature check).
4. Hit **Deploy**. Once it's live, copy the Render URL
   (e.g. `https://ability-cv-api.onrender.com`). Visit `/api/health` to
   sanity-check — should return `{"status": "ok", ...}`.

### 1.3 Deploy the frontend on Vercel

1. Sign up at https://vercel.com with your GitHub account.
2. Click **Add New → Project** and pick the repo.
3. Vercel auto-detects `vercel.json`, so just hit **Deploy**.
4. Once it's live, copy your Vercel URL (e.g. `https://ability-cv.vercel.app`).
5. In **Project Settings → Environment Variables**, add:
   - `VITE_API_BASE` = the Render URL from step 1.2 (e.g.
     `https://ability-cv-api.onrender.com`).
6. Click **Deployments → Redeploy** to rebuild with the env var.

### 1.4 Set up Supabase Auth

We use Supabase Auth for invite-only magic-link sign-in.

1. Sign up at https://supabase.com and create a new project (free tier is
   plenty). Pick any region close to your users.
2. Once the project is provisioned, go to **Project Settings → API**. Copy:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`) → use as
     `VITE_SUPABASE_URL` and `JWT_ISSUER` (append `/auth/v1`, see step 1.5).
   - **anon public key** → use as `VITE_SUPABASE_ANON_KEY`.
   - **JWT Secret** (under "JWT Settings") → use as `JWT_SECRET` on the
     backend (optional but recommended).
3. **Lock down sign-ups** — go to **Authentication → Providers → Email** and
   make sure **"Enable Email Signup"** is **off** (or switch to invite-only
   in **Authentication → Settings**). This prevents random people from
   creating accounts.
4. **Add redirect URL** — under **Authentication → URL Configuration**, add
   your Vercel URL (e.g. `https://ability-cv.vercel.app`) to the allowed
   redirect list so magic links work in production.
5. **Invite consultants** — go to **Authentication → Users → Invite user**
   and add each consultant's email. They'll receive an email to set up
   their account. From then on, they sign in by entering their email and
   clicking a magic link.

Now back in Vercel, add these env vars (Project Settings → Environment
Variables) and redeploy:
- `VITE_API_BASE` = your Render API URL.
- `VITE_SUPABASE_URL` = the Supabase Project URL from step 2.
- `VITE_SUPABASE_ANON_KEY` = the anon public key from step 2.

### 1.5 Tell the backend about the frontend

Back in Render, set these env vars:
- `ALLOWED_ORIGINS` = your Vercel URL (e.g. `https://ability-cv.vercel.app`).
- `JWT_ISSUER` = `https://YOUR_PROJECT.supabase.co/auth/v1` (the Supabase
  project URL with `/auth/v1` appended).
- `JWT_SECRET` = the **JWT Secret** from Supabase **Project Settings → API**.

Hit **Manual Deploy → Clear build cache & deploy** to apply.

---

## 2. Adding / removing consultants

Supabase dashboard → **Authentication → Users**. Click **Invite user** to add
someone, or delete a user to revoke access.

---

## 3. Updating the app

Push to GitHub. Both Vercel and Render rebuild on every push to the main
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
# edit .env.local:
#   VITE_API_BASE=http://localhost:8000
#   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
#   VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
npm install
npm run dev
```

Open http://localhost:5173. Add `http://localhost:5173` to the Supabase
**Authentication → URL Configuration → Redirect URLs** list so magic links
work locally too.

To bypass auth entirely while iterating on UI, run the backend with
`REQUIRE_AUTH=0` and temporarily edit `App.jsx` to skip the login gate.

---

## 5. Costs (typical)

| Service | Plan | Monthly |
|---------|------|---------|
| Vercel | Hobby (free) | $0 (100GB bandwidth, unlimited static deploys) |
| Render  | Free tier | $0 (spins down after 15 min idle; ~30s cold start) |
| Render  | Starter | $7 (no cold starts — recommended once the team uses it daily) |
| Auth provider | Supabase free tier | $0 (covers 50k MAU) |
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
