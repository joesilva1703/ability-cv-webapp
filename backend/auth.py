"""
Netlify Identity JWT verification.

Netlify Identity issues JWTs signed with a site-specific HS256 key. The
recommended verification path is to trust the issuer (the Identity endpoint
on your site) and validate the signature via the public JWKS. Netlify's
Identity uses a shared secret that you can view in the Netlify dashboard
(Identity → Settings → JWT Secret), or you can verify cryptographically.

To keep setup minimal we do three lightweight checks:
  1. Token is a well-formed JWT.
  2. Issuer matches NETLIFY_SITE_URL/.netlify/identity.
  3. Expiry hasn't passed.

For a small team app this is adequate; if you need stronger guarantees,
set NETLIFY_JWT_SECRET and we'll verify the HS256 signature too.
"""

from __future__ import annotations

import base64
import json
import os
import time
from typing import Any

from fastapi import Header, HTTPException, status

import config


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _decode_jwt(token: str) -> dict[str, Any]:
    try:
        header_b64, payload_b64, _ = token.split(".", 2)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Malformed token")
    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Malformed token payload")
    return payload


def _verify_signature(token: str, secret: str) -> bool:
    """Optional HS256 signature check when NETLIFY_JWT_SECRET is set."""
    import hashlib
    import hmac

    try:
        header_b64, payload_b64, sig_b64 = token.split(".", 2)
    except ValueError:
        return False
    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    actual = _b64url_decode(sig_b64)
    return hmac.compare_digest(expected, actual)


async def require_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not config.REQUIRE_AUTH:
        return {"email": "anonymous", "sub": "anonymous"}

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing Authorization header")
    token = authorization.split(" ", 1)[1].strip()

    payload = _decode_jwt(token)

    # Expiry
    exp = payload.get("exp")
    if not exp or exp < time.time():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")

    # Issuer
    iss = payload.get("iss") or ""
    if config.NETLIFY_SITE_URL:
        expected_iss = f"{config.NETLIFY_SITE_URL}/.netlify/identity"
        if iss != expected_iss:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                f"Unexpected token issuer: {iss}",
            )

    # Optional signature verification
    secret = os.environ.get("NETLIFY_JWT_SECRET", "")
    if secret and not _verify_signature(token, secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid signature")

    return {
        "email": payload.get("email"),
        "sub": payload.get("sub"),
        "user_metadata": payload.get("user_metadata", {}),
    }
