from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.ml_train import router as ml_train_router
from app.routers.ocr import router as ocr_router

app = FastAPI(title="Document Intelligence Pipeline API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocr_router)
app.include_router(ml_train_router)

@app.get("/")
def root():
    return {
        "message": "FastAPI -> OpenCV/PIL -> OCR -> Validation/Anomaly -> Confidence -> Dashboard",
        "analyze_endpoint": "/pipeline/analyze",
        "feedback_endpoint": "/pipeline/feedback",
        "dashboard_endpoint": "/pipeline/dashboard",
        "ml_train_endpoint": "POST /ml/train-from-api (admin header required)",
        "ml_metrics_endpoint": "GET /ml/last-metrics (admin)",
        "ml_evaluation_endpoint": "GET /ml/evaluation (admin)",
        "ml_model_info": "GET /ml/model-info (admin)",
        "admin_header": "X-DocIntel-User-Email must match DOCINTEL_ADMIN_EMAIL",
    }
