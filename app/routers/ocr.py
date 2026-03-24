from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.ocr_service import analyze_document, dashboard_metrics, save_feedback

router = APIRouter(prefix="/pipeline", tags=["Document Intelligence Pipeline"])
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


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
        "name": corrected_name or None,
        "date": corrected_date or None,
        "amount": float(corrected_amount) if corrected_amount else None,
    }
    return save_feedback(doc_id=doc_id, corrected_fields=corrections, reviewer=reviewer)


@router.get("/dashboard")
async def dashboard() -> Dict[str, Any]:
    return dashboard_metrics()
