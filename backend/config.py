"""Minimal config for the backend — env vars only."""
from __future__ import annotations

import os

ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL: str = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")

# Comma-separated list of allowed frontend origins for CORS.
# Example: "https://ability-cv.vercel.app,http://localhost:5173"
ALLOWED_ORIGINS: list[str] = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]

# JWT verification — provider-agnostic so we can swap auth providers without
# touching this code. Falls back to the legacy NETLIFY_SITE_URL var so existing
# deployments keep working during the cutover.
#
# JWT_ISSUER is the expected `iss` claim on incoming tokens. For Netlify
# Identity that's f"{site_url}/.netlify/identity"; for Supabase it's the
# project URL; for Auth0 it's the tenant URL; etc.
JWT_ISSUER: str = (
    os.environ.get("JWT_ISSUER")
    or (
        f"{os.environ['NETLIFY_SITE_URL'].rstrip('/')}/.netlify/identity"
        if os.environ.get("NETLIFY_SITE_URL")
        else ""
    )
)

# If "1", require a valid JWT on every request.
REQUIRE_AUTH: bool = os.environ.get("REQUIRE_AUTH", "1") == "1"

DEFAULT_INTRODUCER = {
    "name": os.environ.get("DEFAULT_INTRODUCER_NAME", "Joe"),
    "phone": os.environ.get("DEFAULT_INTRODUCER_PHONE", "010 593 4900"),
    "email": os.environ.get("DEFAULT_INTRODUCER_EMAIL", "joe@abilitygroup.co.za"),
}
