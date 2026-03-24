import io
import json
import os
import re
import shutil
import base64
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import pytesseract
import requests
from PIL import Image, ImageOps
from pyod.models.iforest import IForest
from pypdf import PdfReader
from sklearn.ensemble import IsolationForest

# Resolve next to project root (parent of `app/`) so dashboard & uploads work regardless of CWD.
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = PROJECT_ROOT / "uploads"
OUTPUT_DIR = PROJECT_ROOT / "output"
FEEDBACK_FILE = OUTPUT_DIR / "feedback.jsonl"

DATE_REGEX = (
    r"\b(?:\d{4}[-/]\d{2}[-/]\d{2}"
    r"|\d{2}[-/.]\d{2}[-/.]\d{4}"
    r"|\d{2}[-/]\d{2}[-/]\d{4})\b"
)
AMOUNT_REGEX = r"\b(?:INR|Rs\.?|USD|\$)?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b"
NAME_REGEX = r"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})\b"


@dataclass
class OCRResult:
    text: str
    avg_confidence: float
    low_confidence_words: List[Dict[str, Any]]
    provider: str


def _ensure_dirs() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _configure_tesseract() -> bool:
    """
    Resolve tesseract executable: TESSERACT_CMD, PATH, then common Windows installs.
    """
    cmd = getattr(pytesseract.pytesseract, "tesseract_cmd", None)
    if cmd and Path(cmd).is_file():
        return True

    candidates: List[str] = []
    if cmd:
        candidates.append(str(cmd))
    env_cmd = os.environ.get("TESSERACT_CMD")
    if env_cmd:
        candidates.append(env_cmd.strip().strip('"'))
    found = shutil.which("tesseract")
    if found:
        candidates.append(found)
    if os.name == "nt":
        pf = os.environ.get("ProgramFiles", r"C:\Program Files")
        pfx86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
        candidates.extend(
            [
                os.path.join(pf, "Tesseract-OCR", "tesseract.exe"),
                os.path.join(pfx86, "Tesseract-OCR", "tesseract.exe"),
            ]
        )
    for path in candidates:
        if path and Path(path).is_file():
            pytesseract.pytesseract.tesseract_cmd = path
            return True
    return False


def _osd_correct_rotation_gray(gray: np.ndarray) -> np.ndarray:
    """
    Use Tesseract orientation script (OSD) to fix 90° / 180° / 270° rotations.
    Requires osd trained data; on failure returns the input unchanged.
    """
    if not _configure_tesseract():
        return gray
    h, w = gray.shape[:2]
    small = gray
    max_dim = 1400
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        nw, nh = int(w * scale), int(h * scale)
        small = cv2.resize(gray, (nw, nh), interpolation=cv2.INTER_AREA)
    try:
        osd = pytesseract.image_to_osd(small, config="--psm 0")
    except Exception:
        return gray
    m = re.search(r"Rotate:\s*(\d+)", osd)
    if not m:
        return gray
    rot = int(m.group(1))
    if rot == 0:
        return gray
    if rot == 90:
        return cv2.rotate(gray, cv2.ROTATE_90_CLOCKWISE)
    if rot == 180:
        return cv2.rotate(gray, cv2.ROTATE_180)
    if rot == 270:
        return cv2.rotate(gray, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return gray


def _deskew_gray(gray: np.ndarray, max_angle: float = 15.0) -> np.ndarray:
    """Correct small skew from scanned / tilted pages (fine rotation)."""
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = cv2.findNonZero(thresh)
    if coords is None or len(coords) < 40:
        return gray
    rect = cv2.minAreaRect(coords)
    angle = float(rect[-1])
    if angle < -45:
        angle = 90.0 + angle
    elif angle > 45:
        angle = angle - 90.0
    if abs(angle) < 0.15 or abs(angle) > max_angle:
        return gray
    h, w = gray.shape[:2]
    center = (w // 2, h // 2)
    m = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(gray, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def preprocess_image(raw_bytes: bytes) -> np.ndarray:
    """EXIF upright → resize → denoise → OSD page rotation → deskew → adaptive threshold."""
    pil_image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    try:
        pil_image = ImageOps.exif_transpose(pil_image)
    except Exception:
        pass
    pil_image = pil_image.resize(
        (max(900, pil_image.width), max(1200, pil_image.height)),
        Image.Resampling.LANCZOS,
    )
    image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, h=15)
    oriented = _osd_correct_rotation_gray(denoised)
    deskewed = _deskew_gray(oriented)
    thresh = cv2.adaptiveThreshold(
        deskewed, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 12
    )
    return thresh


def _azure_ocr(image_bytes: bytes) -> Optional[OCRResult]:
    endpoint = os.getenv("AZURE_OCR_ENDPOINT")
    key = os.getenv("AZURE_OCR_KEY")
    if not endpoint or not key:
        return None

    url = endpoint.rstrip("/") + "/vision/v3.2/ocr?language=unk&detectOrientation=true"
    headers = {"Ocp-Apim-Subscription-Key": key, "Content-Type": "application/octet-stream"}

    try:
        response = requests.post(url, headers=headers, data=image_bytes, timeout=20)
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return None

    words: List[str] = []
    for region in payload.get("regions", []):
        for line in region.get("lines", []):
            for word in line.get("words", []):
                words.append(word.get("text", ""))
    text = " ".join(w for w in words if w)
    if not text.strip():
        return None
    return OCRResult(text=text, avg_confidence=0.88, low_confidence_words=[], provider="azure_ocr")


def _pytesseract_ocr(preprocessed_image: np.ndarray) -> OCRResult:
    if not _configure_tesseract():
        return OCRResult(
            text="",
            avg_confidence=0.0,
            low_confidence_words=[],
            provider="pytesseract_not_installed",
        )
    try:
        data = pytesseract.image_to_data(
            preprocessed_image, output_type=pytesseract.Output.DICT, config="--oem 3 --psm 6"
        )
    except pytesseract.TesseractNotFoundError:
        return OCRResult(
            text="",
            avg_confidence=0.0,
            low_confidence_words=[],
            provider="pytesseract_not_installed",
        )
    words, confs, low_conf = [], [], []
    for i, word in enumerate(data["text"]):
        token = (word or "").strip()
        conf_raw = data["conf"][i]
        try:
            conf = float(conf_raw)
        except (TypeError, ValueError):
            conf = -1.0
        if token:
            words.append(token)
            if conf >= 0:
                confs.append(conf)
                if conf < 45:
                    low_conf.append(
                        {
                            "word": token,
                            "confidence": conf,
                            "bbox": {
                                "x": int(data["left"][i]),
                                "y": int(data["top"][i]),
                                "w": int(data["width"][i]),
                                "h": int(data["height"][i]),
                            },
                        }
                    )
    avg_conf = float(np.mean(confs)) if confs else 0.0
    return OCRResult(
        text=" ".join(words),
        avg_confidence=avg_conf / 100.0,
        low_confidence_words=low_conf,
        provider="pytesseract",
    )


def _extract_from_pdf(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    chunks: List[str] = []
    for page in reader.pages:
        chunks.append(page.extract_text() or "")
    return "\n".join(chunks)


def _text_for_display(raw: str) -> str:
    """Human-readable OCR view: tokens separated by comma + space (extraction still uses raw spacing)."""
    if not (raw or "").strip():
        return ""
    parts = [p for p in re.split(r"\s+", raw.strip()) if p]
    return ", ".join(parts)


def _extract_fields(text: str) -> Dict[str, Any]:
    date = re.findall(DATE_REGEX, text)
    amount_tokens = [match[0] for match in re.findall(AMOUNT_REGEX, text)]
    names = re.findall(NAME_REGEX, text)
    amount_value = None
    if amount_tokens:
        cleaned = amount_tokens[0].replace(",", "")
        try:
            amount_value = float(cleaned)
        except ValueError:
            amount_value = None
    frame = pd.DataFrame(
        [
            {
                "name": names[0] if names else None,
                "date": date[0] if date else None,
                "amount": amount_value,
            }
        ]
    )
    return frame.iloc[0].to_dict()


def _rule_validation(fields: Dict[str, Any]) -> Dict[str, Any]:
    missing_fields = [k for k, v in fields.items() if v in (None, "", np.nan)]
    format_errors: List[str] = []
    if fields.get("date") and not re.search(DATE_REGEX, str(fields["date"])):
        format_errors.append("Invalid date format")
    amount = fields.get("amount")
    if amount is not None and (amount < 0 or amount > 1_000_000_000):
        format_errors.append("Amount out of realistic range")
    passed = not missing_fields and not format_errors
    return {"passed": passed, "missing_fields": missing_fields, "format_errors": format_errors}


def _anomaly_scores(text: str, fields: Dict[str, Any], ocr_conf: float) -> Dict[str, Any]:
    amount = float(fields.get("amount") or 0.0)
    text_len = len(text)
    word_count = len(text.split())
    feature_vec = np.array([[text_len, word_count, amount, ocr_conf]])

    sk_model = IsolationForest(random_state=42, contamination=0.12)
    baseline = np.array(
        [
            [600, 120, 2400, 0.9],
            [500, 90, 1800, 0.92],
            [720, 140, 3200, 0.88],
            [680, 130, 2900, 0.91],
            [560, 95, 2100, 0.89],
        ]
    )
    sk_model.fit(baseline)
    sk_pred = int(sk_model.predict(feature_vec)[0])
    sk_score = float(sk_model.decision_function(feature_vec)[0])

    pyod_model = IForest(contamination=0.12, random_state=42)
    pyod_model.fit(baseline)
    pyod_pred = int(pyod_model.predict(feature_vec)[0])  # 1 means outlier

    is_anomaly = bool(sk_pred == -1 or pyod_pred == 1)
    return {
        "is_anomaly": is_anomaly,
        "sklearn_score": sk_score,
        "pyod_outlier": bool(pyod_pred == 1),
        "feature_vector": {
            "text_length": text_len,
            "word_count": word_count,
            "amount": amount,
            "ocr_confidence": ocr_conf,
        },
    }


def _confidence_score(ocr_conf: float, validation: Dict[str, Any], anomaly: Dict[str, Any]) -> float:
    validation_score = 1.0 if validation["passed"] else max(0.0, 1.0 - 0.25 * len(validation["missing_fields"]) - 0.2 * len(validation["format_errors"]))
    anomaly_penalty = 0.25 if anomaly["is_anomaly"] else 0.0
    score = (0.45 * ocr_conf) + (0.45 * validation_score) + (0.10 * (1.0 - anomaly_penalty))
    return round(max(0.0, min(1.0, score)) * 100.0, 2)


def _plot_to_data_url(fig: Any) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=140, bbox_inches="tight")
    plt.close(fig)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _generate_dashboard_charts(frame: pd.DataFrame) -> Dict[str, str]:
    status_counts = frame["status"].value_counts()
    ok_count = int(status_counts.get("OK", 0))
    flagged_count = int(status_counts.get("FLAGGED", 0))

    pie_fig, pie_ax = plt.subplots(figsize=(4.8, 3.6), facecolor="#0b1220")
    pie_ax.set_facecolor("#0b1220")
    # Matplotlib 3.8+ returns (wedges, texts, autotexts) when autopct is set — not 2 values.
    pie_result = pie_ax.pie(
        [max(ok_count, 0), max(flagged_count, 0)],
        labels=["OK", "FLAGGED"],
        colors=["#10b981", "#ef4444"],
        autopct=lambda p: f"{p:.1f}%" if p > 0 else "",
        startangle=140,
        textprops={"color": "#e5e7eb", "fontsize": 9},
    )
    wedges = pie_result[0]
    for wedge in wedges:
        wedge.set_linewidth(1.0)
        wedge.set_edgecolor("#0f172a")
    pie_ax.set_title("Document Status Split", color="#f8fafc", fontsize=11, fontweight="bold")
    pie_ax.axis("equal")

    conf_fig, conf_ax = plt.subplots(figsize=(4.8, 3.6), facecolor="#0b1220")
    conf_ax.set_facecolor("#0b1220")
    bins = [0, 50, 60, 70, 80, 90, 100]
    conf_ax.hist(frame["confidence_score"].astype(float), bins=bins, color="#3b82f6", edgecolor="#0f172a")
    conf_ax.set_title("Confidence Distribution", color="#f8fafc", fontsize=11, fontweight="bold")
    conf_ax.set_xlabel("Confidence score", color="#cbd5e1", fontsize=9)
    conf_ax.set_ylabel("Documents", color="#cbd5e1", fontsize=9)
    conf_ax.tick_params(colors="#cbd5e1", labelsize=8)
    for spine in conf_ax.spines.values():
        spine.set_color("#334155")
    conf_ax.grid(axis="y", color="#1e293b", linestyle="--", linewidth=0.6, alpha=0.9)

    return {
        "status_pie": _plot_to_data_url(pie_fig),
        "confidence_histogram": _plot_to_data_url(conf_fig),
    }


def analyze_document(doc_id: str, filename: str, raw_bytes: bytes) -> Dict[str, Any]:
    _ensure_dirs()
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext == "pdf":
        text = _extract_from_pdf(raw_bytes)
        ocr_result = OCRResult(
            text=text,
            avg_confidence=0.78 if text.strip() else 0.0,
            low_confidence_words=[],
            provider="pdf_text_or_tesseract",
        )
    else:
        pre = preprocess_image(raw_bytes)
        _, png_bytes = cv2.imencode(".png", pre)
        azure_result = _azure_ocr(png_bytes.tobytes())
        ocr_result = azure_result or _pytesseract_ocr(pre)

    raw_text = ocr_result.text
    fields = _extract_fields(raw_text)
    validation = _rule_validation(fields)
    anomaly = _anomaly_scores(raw_text, fields, ocr_result.avg_confidence)
    confidence = _confidence_score(ocr_result.avg_confidence, validation, anomaly)

    setup_notes: List[str] = []
    if ocr_result.provider == "pytesseract_not_installed":
        setup_notes.append(
            "Tesseract OCR is not installed or not found. Install it and add to PATH, "
            "or set environment variable TESSERACT_CMD to the full path of tesseract.exe"
        )
        setup_notes.append(
            "Windows installer (UB Mannheim): https://github.com/UB-Mannheim/tesseract/wiki"
        )
    elif not (raw_text or "").strip() and ext in ("png", "jpg", "jpeg", "webp", "tif", "tiff", "bmp"):
        setup_notes.append(
            "No text was extracted — try a higher-contrast scan, or install/configure Tesseract / Azure OCR."
        )

    payload = {
        "doc_id": doc_id,
        "filename": filename,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "ocr_provider": ocr_result.provider,
        "text": _text_for_display(raw_text),
        "fields": fields,
        "validation": validation,
        "anomaly": anomaly,
        "ocr_confidence": round(ocr_result.avg_confidence, 4),
        "low_confidence_words": ocr_result.low_confidence_words,
        "confidence_score": confidence,
        "status": "FLAGGED" if confidence < 70 or anomaly["is_anomaly"] else "OK",
        "ocr_setup_notes": setup_notes,
    }

    with open(OUTPUT_DIR / f"{doc_id}.json", "w", encoding="utf-8") as out_file:
        json.dump(payload, out_file, indent=2)
    return payload


def save_feedback(doc_id: str, corrected_fields: Dict[str, Any], reviewer: str) -> Dict[str, Any]:
    _ensure_dirs()
    record = {
        "doc_id": doc_id,
        "reviewer": reviewer,
        "corrected_fields": corrected_fields,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    with open(FEEDBACK_FILE, "a", encoding="utf-8") as fb:
        fb.write(json.dumps(record) + "\n")
    return {"saved": True, "record": record}


def dashboard_metrics() -> Dict[str, Any]:
    _ensure_dirs()
    docs: List[Dict[str, Any]] = []
    for file in OUTPUT_DIR.glob("*.json"):
        if file.name == FEEDBACK_FILE.name:
            continue
        with open(file, "r", encoding="utf-8") as f:
            docs.append(json.load(f))

    out_resolved = str(OUTPUT_DIR.resolve())
    if not docs:
        return {
            "documents": 0,
            "flagged": 0,
            "avg_confidence": 0.0,
            "recent": [],
            "charts": {},
            "output_dir": out_resolved,
        }

    frame = pd.DataFrame(
        [{"doc_id": d["doc_id"], "status": d["status"], "confidence_score": d["confidence_score"]} for d in docs]
    )
    flagged = int((frame["status"] == "FLAGGED").sum())
    avg_conf = round(float(frame["confidence_score"].mean()), 2)
    recent = sorted(docs, key=lambda x: x["timestamp"], reverse=True)[:5]
    charts: Dict[str, str] = {}
    try:
        charts = _generate_dashboard_charts(frame)
    except Exception:
        pass
    return {
        "documents": int(len(docs)),
        "flagged": flagged,
        "avg_confidence": avg_conf,
        "charts": charts,
        "output_dir": out_resolved,
        "recent": [
            {"doc_id": d["doc_id"], "filename": d["filename"], "status": d["status"], "confidence_score": d["confidence_score"]}
            for d in recent
        ],
    }
