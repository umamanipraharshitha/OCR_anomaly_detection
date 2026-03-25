from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.deps import require_dashboard_admin
from app.services.ocr_service import UPLOAD_DIR, analyze_document, dashboard_metrics, save_feedback

router = APIRouter(prefix="/pipeline", tags=["Document Intelligence Pipeline"])
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _parse_optional_amount(raw: str) -> Optional[float]:
    s = (raw or "").strip()
    if not s:
        return None
    try:
        return float(s.replace(",", ""))
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid amount value: {raw!r}") from None


def _optional_clean_str(value: str) -> Optional[str]:
    v = (value or "").strip()
    return v or None


@router.post("/analyze")
async def analyze_file(doc_id: str = Form(...), file: UploadFile = File(...)) -> Dict[str, Any]:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file upload.")
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required.")
    upload_path = UPLOAD_DIR / f"{doc_id}_{file.filename}"
    with open(upload_path, "wb") as out:
        out.write(raw)
    return analyze_document(doc_id=doc_id, filename=file.filename, raw_bytes=raw)


@router.post("/feedback")
async def submit_feedback(
    doc_id: str = Form(...),
    reviewer: str = Form(...),
    corrected_name: str = Form(default=""),
    corrected_date: str = Form(default=""),
    corrected_amount: str = Form(default=""),
) -> Dict[str, Any]:
    corrections: Dict[str, Any] = {
        "name": _optional_clean_str(corrected_name),
        "date": _optional_clean_str(corrected_date),
        "amount": _parse_optional_amount(corrected_amount),
    }
    try:
        return save_feedback(doc_id=doc_id, corrected_fields=corrections, reviewer=reviewer)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/dashboard")
async def dashboard(_admin: str = Depends(require_dashboard_admin)) -> Dict[str, Any]:
    _ = _admin
    return dashboard_metrics()
