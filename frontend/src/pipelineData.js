export const PIPELINE_STEPS = [
  {
    n: "01",
    title: "Ingestion",
    desc: "Cheques, KYC packs, loan PDFs, claims — accepted via secure API upload.",
    tags: ["FastAPI", "multipart"],
  },
  {
    n: "02",
    title: "Preprocess",
    desc: "Deskew, denoise, binarize, resize — tuned for messy scans.",
    tags: ["OpenCV", "PIL"],
  },
  {
    n: "03",
    title: "OCR / ICR",
    desc: "Raw text plus per-token confidence for downstream risk scoring.",
    tags: ["Tesseract", "Azure OCR"],
  },
  {
    n: "04",
    title: "Validation & anomalies",
    desc: "Regex rules, cross-field logic, isolation models, and OCR confidence fusion.",
    tags: ["Regex", "PyOD", "sklearn"],
  },
  {
    n: "05",
    title: "Confidence",
    desc: "Single 0–100 score per field and per document for queue prioritization.",
    tags: ["Weighted scorer"],
  },
  {
    n: "06",
    title: "Review UI",
    desc: "Flagged queue, heatmaps, and analyst corrections logged for audit.",
    tags: ["React", "Dashboard"],
  },
  {
    n: "07",
    title: "Feedback loop",
    desc: "Corrections feed retraining — accuracy improves on your institution’s data.",
    tags: ["JSONL", "retrain"],
  },
];
