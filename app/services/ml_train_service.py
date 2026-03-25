"""
Train a tabular ML model from JSON fetched over HTTP, persist as .pkl, report metrics.
Isolated from the document / OCR pipeline (ocr_service.py).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
import requests
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    explained_variance_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


def _rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    mse = mean_squared_error(y_true, y_pred)
    return float(np.sqrt(mse))


def _to_json_safe(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {str(k): _to_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_json_safe(v) for v in obj]
    if isinstance(obj, (np.floating, np.integer)):
        return float(obj)
    if isinstance(obj, float):
        return obj
    if isinstance(obj, (str, int, bool)) or obj is None:
        return obj
    return str(obj)

MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = MODELS_DIR / "api_trained_model.pkl"
METRICS_PATH = MODELS_DIR / "last_train_metrics.json"

_last_metrics: Optional[Dict[str, Any]] = None


def get_last_metrics() -> Optional[Dict[str, Any]]:
    global _last_metrics
    if _last_metrics is not None:
        return _last_metrics
    if METRICS_PATH.is_file():
        with open(METRICS_PATH, encoding="utf-8") as f:
            _last_metrics = json.load(f)
        return _last_metrics
    return None


def fetch_json_dataset(
    url: str,
    headers: Optional[Dict[str, str]] = None,
    timeout: float = 60.0,
) -> Any:
    resp = requests.get(url, headers=headers or {}, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def records_from_payload(payload: Any, json_path: Optional[str]) -> List[Dict[str, Any]]:
    cur: Any = payload
    if json_path:
        for part in json_path.strip().split("."):
            if not part:
                continue
            if not isinstance(cur, dict) or part not in cur:
                raise ValueError(f"Invalid json_path: missing key '{part}'")
            cur = cur[part]
    if not isinstance(cur, list):
        raise ValueError("Resolved JSON path must be an array of objects")
    if len(cur) == 0:
        raise ValueError("Dataset array is empty")
    if not isinstance(cur[0], dict):
        raise ValueError("Array elements must be objects")
    return cur


def _build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    numeric = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical = [c for c in X.columns if c not in numeric]
    transformers: List[Tuple[str, Pipeline, List[str]]] = []
    if numeric:
        transformers.append(
            (
                "num",
                Pipeline([("imputer", SimpleImputer(strategy="median"))]),
                numeric,
            )
        )
    if categorical:
        transformers.append(
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
                        (
                            "onehot",
                            OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                        ),
                    ]
                ),
                categorical,
            )
        )
    if not transformers:
        raise ValueError("No usable feature columns after preprocessing")
    return ColumnTransformer(transformers=transformers, remainder="drop")


def _classification_metrics(
    y_test: np.ndarray, y_pred: np.ndarray, pipe: Pipeline, X_test: pd.DataFrame
) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision_macro": float(precision_score(y_test, y_pred, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(y_test, y_pred, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(y_test, y_pred, average="macro", zero_division=0)),
        "precision_weighted": float(precision_score(y_test, y_pred, average="weighted", zero_division=0)),
        "recall_weighted": float(recall_score(y_test, y_pred, average="weighted", zero_division=0)),
        "f1_weighted": float(f1_score(y_test, y_pred, average="weighted", zero_division=0)),
        "n_classes": int(len(np.unique(y_test))),
    }
    model = pipe.named_steps["model"]
    if hasattr(model, "predict_proba"):
        y_proba = pipe.predict_proba(X_test)
        classes = getattr(model, "classes_", None)
        try:
            if classes is not None and len(classes) == 2:
                out["roc_auc"] = float(roc_auc_score(y_test, y_proba[:, 1]))
            elif classes is not None and len(classes) > 2:
                out["roc_auc_ovr_weighted"] = float(
                    roc_auc_score(
                        y_test,
                        y_proba,
                        multi_class="ovr",
                        average="weighted",
                        labels=classes,
                    )
                )
        except (ValueError, IndexError):
            out["roc_auc_note"] = "Could not compute ROC AUC (e.g. single class in test split)."
    return out


def train_from_api(
    data_url: str,
    feature_columns: List[str],
    target_column: str,
    *,
    records_json_path: Optional[str] = None,
    task: Literal["classification", "regression"] = "classification",
    test_size: float = 0.2,
    random_state: int = 42,
    api_headers: Optional[Dict[str, str]] = None,
    request_timeout: float = 60.0,
) -> Dict[str, Any]:
    global _last_metrics

    payload = fetch_json_dataset(data_url, headers=api_headers, timeout=request_timeout)
    records = records_from_payload(payload, records_json_path)
    df = pd.DataFrame(records)
    missing_cols = set(feature_columns + [target_column]) - set(df.columns)
    if missing_cols:
        raise ValueError(f"Missing columns in API data: {sorted(missing_cols)}")

    df = df[feature_columns + [target_column]].copy()
    df = df.dropna(subset=[target_column])
    if len(df) < 10:
        raise ValueError("Need at least 10 rows with non-null target after filtering")

    X = df[feature_columns]
    y = df[target_column]

    if task == "classification":
        if y.dtype == object or y.dtype.name == "string":
            y = y.astype("category")
        y_arr = np.asarray(y)
        stratify = None
        if len(np.unique(y_arr)) > 1:
            vc = pd.Series(y_arr).value_counts()
            if vc.min() >= 2:
                stratify = y_arr
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_arr, test_size=test_size, random_state=random_state, stratify=stratify
        )
        pre = _build_preprocessor(X_train)
        model = HistGradientBoostingClassifier(
            max_iter=500,
            learning_rate=0.06,
            max_depth=None,
            min_samples_leaf=20,
            l2_regularization=0.1,
            random_state=random_state,
        )
    else:
        y_arr = pd.to_numeric(y, errors="coerce")
        mask = ~y_arr.isna()
        X = X.loc[mask]
        y_arr = y_arr.loc[mask].to_numpy()
        if len(y_arr) < 10:
            raise ValueError("Need at least 10 numeric targets for regression")
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_arr, test_size=test_size, random_state=random_state
        )
        pre = _build_preprocessor(X_train)
        model = HistGradientBoostingRegressor(
            max_iter=500,
            learning_rate=0.06,
            max_depth=None,
            min_samples_leaf=20,
            l2_regularization=0.1,
            random_state=random_state,
        )

    pipe = Pipeline([("preprocess", pre), ("model", model)])
    pipe.fit(X_train, y_train)

    if task == "classification":
        y_pred = pipe.predict(X_test)
        metrics = _classification_metrics(y_test, y_pred, pipe, X_test)
        metrics["classification_report"] = _to_json_safe(
            classification_report(y_test, y_pred, output_dict=True, zero_division=0)
        )
    else:
        y_pred = pipe.predict(X_test)
        ev = float(explained_variance_score(y_test, y_pred))
        if np.isnan(ev):
            ev = None
        metrics = {
            "mean_absolute_error": float(mean_absolute_error(y_test, y_pred)),
            "root_mean_squared_error": _rmse(y_test, y_pred),
            "r2_score": float(r2_score(y_test, y_pred)),
            "explained_variance": ev,
        }

    bundle = {
        "pipeline": pipe,
        "task": task,
        "feature_columns": list(feature_columns),
        "target_column": target_column,
        "data_url": data_url,
        "records_json_path": records_json_path,
    }
    joblib.dump(bundle, MODEL_PATH)

    result = {
        "model_path": str(MODEL_PATH.resolve()),
        "task": task,
        "n_rows": int(len(df)),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "metrics": metrics,
    }
    _last_metrics = result
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    return result


def load_trained_bundle() -> Dict[str, Any]:
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(f"No saved model at {MODEL_PATH}")
    return joblib.load(MODEL_PATH)


def get_evaluation_report() -> Dict[str, Any]:
    """Full evaluation snapshot for admin UI: holdout metrics + saved model metadata."""
    ev = get_last_metrics()
    if ev is None:
        return {"evaluation": None, "model_metadata": None}
    meta: Optional[Dict[str, Any]] = None
    try:
        b = load_trained_bundle()
        meta = {
            "task": b.get("task"),
            "feature_columns": b.get("feature_columns"),
            "target_column": b.get("target_column"),
            "data_url": b.get("data_url"),
            "records_json_path": b.get("records_json_path"),
        }
    except FileNotFoundError:
        meta = None
    return {
        "evaluation": ev,
        "model_metadata": meta,
        "metrics_file": str(METRICS_PATH.resolve()),
        "model_file": str(MODEL_PATH.resolve()) if MODEL_PATH.is_file() else None,
    }
