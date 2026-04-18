"""
Parse raw CV text into the structured JSON schema expected by fill_cv.py,
using the Claude API.

The LLM is given the full CV text and asked to return a JSON object that
matches the exact schema. We validate and normalise the result before
returning it to the app.
"""

from __future__ import annotations

import json
import re
from typing import Any

from anthropic import Anthropic

import config


SYSTEM_PROMPT = """You are a recruitment assistant for Ability Executive Recruitment in South Africa.

You extract structured data from candidate CVs so they can be reformatted into \
the agency's branded template for client submission.

You will be given the raw text of a CV. Return a single JSON object that \
matches the schema below. Do not wrap it in markdown fences, do not add \
commentary — just the JSON.

RULES:
- Never fabricate facts. If a field is not in the CV, set it to null.
- work_summary and work_experience must be reverse-chronological (most recent first) \
  and must cover the same jobs.
- For each role, extract 4-8 concise duty bullets. Keep the candidate's phrasing \
  but tighten for readability. Do not invent responsibilities.
- Dates: normalise to "Month YYYY – Month YYYY" where the source is clear, \
  otherwise preserve the candidate's format.
- EE/Gender: only fill if explicitly stated (e.g. "African Female", "Coloured Male"). \
  Do not infer from a name.
- summary.paragraph: 2-4 sentences. Lead with total years in the relevant function, \
  then industries/sectors, then differentiators. Written so a hiring manager can \
  decide to interview in 10 seconds.
- summary.bullets: 3-5 scannable bullets covering years + function, signature \
  achievements, key tech/tools, qualifications, notable industries. Do not repeat \
  the paragraph verbatim.
- position: the job title the candidate should be submitted for — take from the \
  current/most recent role unless otherwise obvious.

SCHEMA:
{
  "summary": {
    "paragraph": "string",
    "bullets": ["string", ...]
  },
  "candidate": {
    "name": "string",
    "position": "string",
    "location": "string | null",
    "ee_gender": "string | null",
    "availability": "string | null",
    "nationality": "string | null",
    "current_salary": "string | null",
    "expected_salary": "string | null",
    "id_number": "string | null"
  },
  "work_summary": [
    {"company": "string", "position": "string", "dates": "string"}
  ],
  "school": {
    "name": "string | null",
    "date": "string | null",
    "matric": "string | null"
  },
  "tertiary": [
    {"institution": "string", "date": "string | null", "qualification": "string"}
  ],
  "memberships": ["string", ...],
  "skills": ["string", ...],
  "computer_skills": ["string", ...],
  "work_experience": [
    {
      "company": "string",
      "position": "string",
      "dates": "string",
      "duties": ["string", ...],
      "reason_for_leaving": "string | null"
    }
  ]
}
"""


class ParserError(RuntimeError):
    pass


def parse_cv(cv_text: str, api_key: str | None = None, model: str | None = None) -> dict[str, Any]:
    api_key = api_key or config.ANTHROPIC_API_KEY
    if not api_key:
        raise ParserError(
            "ANTHROPIC_API_KEY is not set. Add it in Settings or set the "
            "environment variable."
        )
    model = model or config.CLAUDE_MODEL

    client = Anthropic(api_key=api_key)
    resp = client.messages.create(
        model=model,
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "Extract the CV below into the JSON schema. Return JSON only.\n\n"
                    "---BEGIN CV---\n"
                    + cv_text
                    + "\n---END CV---"
                ),
            }
        ],
    )
    text = "".join(
        block.text for block in resp.content if getattr(block, "type", None) == "text"
    ).strip()

    # If Claude hit the token ceiling, the JSON is almost certainly truncated.
    # Surface that clearly instead of letting the downstream parser explode with
    # a cryptic "Expecting ',' delimiter".
    if getattr(resp, "stop_reason", None) == "max_tokens":
        raise ParserError(
            "Claude response was truncated (hit max_tokens). "
            "The CV may be too long — try a shorter version, or raise max_tokens."
        )

    data = _coerce_json(text)
    return _normalise(data)


_CTRL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def _coerce_json(text: str) -> dict[str, Any]:
    """Claude usually returns clean JSON; be defensive anyway."""
    text = text.strip()
    # Strip markdown fences if present.
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)

    # Strip stray control chars that sometimes sneak through from weird CV PDFs
    # (form-feed, vertical tab, etc.) — json.loads rejects these inside strings.
    cleaned = _CTRL_CHARS.sub("", text)

    for candidate in (cleaned, text):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            # Last-ditch: find the outermost {...}
            match = re.search(r"\{.*\}", candidate, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    continue

    # Nothing parsed — show a snippet of what Claude returned so the error
    # message in the browser actually points at the real problem.
    snippet = text[:200].replace("\n", " ")
    raise ParserError(
        f"Claude did not return valid JSON. First 200 chars: {snippet!r}"
    )


def _normalise(data: dict[str, Any]) -> dict[str, Any]:
    """Ensure every expected key exists, with sensible defaults."""
    data.setdefault("summary", {"paragraph": "", "bullets": []})
    data["summary"].setdefault("paragraph", "")
    data["summary"].setdefault("bullets", [])

    data.setdefault("candidate", {})
    for k in (
        "name",
        "position",
        "location",
        "ee_gender",
        "availability",
        "nationality",
        "current_salary",
        "expected_salary",
        "id_number",
    ):
        data["candidate"].setdefault(k, None)

    data.setdefault("work_summary", [])
    data.setdefault("school", {"name": None, "date": None, "matric": None})
    data.setdefault("tertiary", [])
    data.setdefault("memberships", [])
    data.setdefault("skills", [])
    data.setdefault("computer_skills", [])
    data.setdefault("work_experience", [])

    # Make sure work_experience entries have all fields.
    for job in data["work_experience"]:
        job.setdefault("company", None)
        job.setdefault("position", None)
        job.setdefault("dates", None)
        job.setdefault("duties", [])
        job.setdefault("reason_for_leaving", None)

    return data
