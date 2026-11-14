"""Bearer-token guard for endpoints that are not for everyone (ingest, admin controls)."""

import hmac
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, params, status


def require_bearer_token(settings_field: str) -> params.Depends:
    """Dependency that checks `Authorization: Bearer <token>` against a settings field.

    An empty setting refuses every call (503), so a missing secret never means "open".

    Example:
        @router.post("/x", dependencies=[require_bearer_token("ingest_token")])
    """

    def check(request: Request, authorization: Annotated[str | None, Header()] = None) -> None:
        expected = getattr(request.app.state.settings, settings_field)
        if not expected:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                f"{settings_field} is not configured; set it in the environment",
            )
        if not _token_matches(authorization, expected):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or missing bearer token")

    guard: Callable[..., None] = check
    return Depends(guard)


def _token_matches(authorization: str | None, expected: str) -> bool:
    scheme, _, token = (authorization or "").partition(" ")
    # compare_digest avoids leaking the token through response timing.
    return scheme.lower() == "bearer" and hmac.compare_digest(token.encode(), expected.encode())
