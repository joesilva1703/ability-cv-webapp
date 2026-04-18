"""Minimal config for the backend — env vars only."""
from __future__ import annotations

import os

ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL: str = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")

# Comma-separated list of allowed frontend origins for CORS.
# Example: "https://ability-cv.netlify.app,http://localhost:5173"
ALLOWED_ORIGINS: list[str] = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]

# Netlify Identity JWT verification
# The Identity "site URL" — e.g. https://ability-cv.netlify.app
NETLIFY_SITE_URL: str = os.environ.get("NETLIFY_SITE_URL", "").rstrip("/")

# If "1", require a valid Netlify Identity JWT on every request.
REQUIRE_AUTH: bool = os.environ.get("REQUIRE_AUTH", "1") == "1"

DEFAULT_INTRODUCER = {
    "name": os.environ.get("DEFAULT_INTRODUCER_NAME", "Joe"),
    "phone": os.environ.get("DEFAULT_INTRODUCER_PHONE", "010 593 4900"),
    "email": os.environ.get("DEFAULT_INTRODUCER_EMAIL", "joe@abilitygroup.co.za"),
}
