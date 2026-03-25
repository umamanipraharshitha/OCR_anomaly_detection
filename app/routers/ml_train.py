from typing import Any, Dict, List, Literal, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, HttpUrl

from app.deps import require_dashboard_admin
from app.services import ml_train_service

router = APIRouter(prefix="/ml", tags=["API dataset training"])


class TrainFromApiBody(BaseModel):
    """Train a strong tabular model (HistGradientBoosting) on JSON from an HTTP GET."""

    data_url: HttpUrl
    feature_columns: List[str] = Field(..., min_length=1)
    target_column: str
    records_json_path: Optional[str] = Field(
        default=None,
        description="Dot path to the array of rows, e.g. 'data.items'. Omit if the root JSON is an array.",
    )
    task: Literal["classification", "regression"] = "classification"
    test_size: float = Field(0.2, ge=0.05, le=0.45)
    random_state: int = 42
    api_headers: Optional[Dict[str, str]] = Field(
        default=None,
        description="Optional headers (e.g. Authorization) for the dataset API.",
    )
    request_timeout: float = Field(60.0, ge=5.0, le=600.0)


@router.post("/train-from-api")
def train_from_api(
    body: TrainFromApiBody,
    _admin: str = Depends(require_dashboard_admin),
) -> Dict[str, Any]:
    _ = _admin
    try:
        return ml_train_service.train_from_api(
            str(body.data_url),
            body.feature_columns,
            body.target_column,
            records_json_path=body.records_json_path,
            task=body.task,
            test_size=body.test_size,
            random_state=body.random_state,
            api_headers=body.api_headers,
            request_timeout=body.request_timeout,
        )
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Dataset API request failed: {e}") from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/last-metrics")
def last_metrics(_admin: str = Depends(require_dashboard_admin)) -> Dict[str, Any]:
    _ = _admin
    m = ml_train_service.get_last_metrics()
    if m is None:
        raise HTTPException(status_code=404, detail="No training run recorded yet.")
    return m


@router.get("/evaluation")
def evaluation(_admin: str = Depends(require_dashboard_admin)) -> Dict[str, Any]:
    _ = _admin
    return ml_train_service.get_evaluation_report()


@router.get("/model-info")
def model_info(_admin: str = Depends(require_dashboard_admin)) -> Dict[str, Any]:
    _ = _admin
    path = ml_train_service.MODEL_PATH
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"No saved model at {path}")
    return {
        "model_path": str(path.resolve()),
        "metrics_path": str(ml_train_service.METRICS_PATH.resolve()),
        "exists": True,
    }
