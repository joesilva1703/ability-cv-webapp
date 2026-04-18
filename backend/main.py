"""
Ability CV Formatter — backend API.

Endpoints
---------
GET  /api/health
    Liveness probe.

POST /api/parse
    Multipart upload of a CV (PDF or .docx). Extracts text, sends it to
    Claude, returns the structured JSON payload the frontend edits.

POST /api/generate
    JSON body matching the structured payload. Returns a .docx file.

Auth
----
Every /api endpoint (except /api/health) requires a Bearer token issued by
Netlify Identity. See auth.py.
"""

from __future__ import annotations

import io
import json
import re
import tempfile
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

import config
from auth import require_user
from extractor import EmptyExtractionError, extract_text
from fill_cv import fill_cv
from parser import ParserError, parse_cv


BACKEND_DIR = Path(__file__).parent.resolve()
TEMPLATE_PATH = BACKEND_DIR / "master_template.docx"


app = FastAPI(title="Ability CV Formatter API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# --------------------------------------------------------------------------- #
# Health                                                                       #
# --------------------------------------------------------------------------- #

@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "claude_configured": bool(config.ANTHROPIC_API_KEY),
        "auth_required": config.REQUIRE_AUTH,
    }


# --------------------------------------------------------------------------- #
# Parse                                                                        #
# --------------------------------------------------------------------------- #

@app.post("/api/parse")
async def parse_endpoint(
    file: UploadFile = File(...),
    _user: dict = Depends(require_user),
) -> JSONResponse:
    if not config.ANTHROPIC_API_KEY:
        raise HTTPException(500, "Server is missing ANTHROPIC_API_KEY.")

    filename = file.filename or "cv"
    data_bytes = await file.read()
    if not data_bytes:
        raise HTTPException(400, "Uploaded file is empty.")

    try:
        text = extract_text(data_bytes, filename)
    except EmptyExtractionError as e:
        raise HTTPException(422, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))

    try:
        parsed = parse_cv(text, api_key=config.ANTHROPIC_API_KEY, model=config.CLAUDE_MODEL)
    except ParserError as e:
        raise HTTPException(502, f"Parser error: {e}")

    return JSONResponse(
        {
            "data": parsed,
            "default_introducer": config.DEFAULT_INTRODUCER,
            "source_filename": filename,
        }
    )


# --------------------------------------------------------------------------- #
# Generate                                                                     #
# --------------------------------------------------------------------------- #

def _sanitize_filename(name: str) -> str:
    name = re.sub(r"[^A-Za-z0-9 \-'_]+", "", name or "").strip()
    return name or "Candidate"


def _empty_strings_to_null(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _empty_strings_to_null(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_empty_strings_to_null(v) for v in obj]
    if isinstance(obj, str) and obj.strip() == "":
        return None
    return obj


@app.post("/api/generate")
async def generate_endpoint(
    payload: dict,
    _user: dict = Depends(require_user),
) -> Response:
    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(400, "Body must include a 'data' object.")

    candidate = data.get("candidate") or {}
    if not candidate.get("name"):
        raise HTTPException(400, "candidate.name is required.")

    introducer = (
        payload.get("introducer_override")
        or data.get("introducer")
        or config.DEFAULT_INTRODUCER
    )
    fill_payload = dict(data)
    fill_payload["introducer"] = introducer
    fill_payload = _empty_strings_to_null(fill_payload)

    name = _sanitize_filename(candidate.get("name"))
    filename = f"{name} - CV.docx"

    with tempfile.TemporaryDirectory() as td:
        out_path = Path(td) / filename
        try:
            fill_cv(TEMPLATE_PATH, fill_payload, out_path)
        except Exception as e:  # surfacing for debugging in logs
            raise HTTPException(500, f"Template fill failed: {e}")
        docx_bytes = out_path.read_bytes()

    return Response(
        content=docx_bytes,
        media_type=(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Ability-Filename": filename,
        },
    )


# Entry for `uvicorn main:app`
if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(__import__("os").environ.get("PORT", 8000)))
