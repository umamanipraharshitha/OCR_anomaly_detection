import os
from typing import Optional

from fastapi import Header, HTTPException

_DEFAULT_ADMIN = "mpraharshitha2006@gmail.com"


def get_admin_email() -> str:
    return (os.getenv("DOCINTEL_ADMIN_EMAIL") or _DEFAULT_ADMIN).lower().strip()


def require_dashboard_admin(
    x_doc_intel_user_email: Optional[str] = Header(
        default=None,
        alias="X-DocIntel-User-Email",
        description="Signed-in user email; must match server admin for analytics.",
    ),
) -> str:
    admin = get_admin_email()
    candidate = (x_doc_intel_user_email or "").lower().strip()
    if not candidate or candidate != admin:
        raise HTTPException(
            status_code=403,
            detail="Dashboard and model analytics are restricted to the administrator account.",
        )
    return candidate
