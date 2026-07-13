"""
Turns employee data into predictions.

Compared to the original app.py, this adds REAL SHAP explanations
(signed, per-prediction contributions from the cached TreeExplainer)
instead of just showing generic global feature importances. SHAP tells
you not just "this feature mattered" but "this feature pushed the
prediction UP or DOWN, by roughly how much".
"""

import numpy as np
import pandas as pd

from app.ml.loader import registry

DEPARTMENTS = ["Engineering", "Sales", "Marketing", "HR", "Finance", "Support"]
TRENDS = ["improving", "stable", "declining"]

RAW_NUMERIC_FIELDS = [
    "tenure_years", "current_salary", "attendance_pct", "avg_login_delay_min",
    "tasks_assigned", "tasks_completed_on_time", "task_completion_rate",
    "quality_score", "manager_rating", "peer_rating", "overtime_hours_month",
    "past_leave_requests", "past_leave_approved_rate",
]

PRETTY_NAMES = {
    "tenure_years": "Tenure (years)",
    "current_salary": "Current Salary",
    "attendance_pct": "Attendance %",
    "avg_login_delay_min": "Avg Login Delay (min)",
    "tasks_assigned": "Tasks Assigned",
    "tasks_completed_on_time": "Tasks Completed On Time",
    "task_completion_rate": "Task Completion Rate",
    "quality_score": "Quality Score",
    "manager_rating": "Manager Rating",
    "peer_rating": "Peer Rating",
    "overtime_hours_month": "Overtime Hours / Month",
    "past_leave_requests": "Past Leave Requests",
    "past_leave_approved_rate": "Past Leave Approval Rate",
}


def pretty_name(col: str) -> str:
    if col in PRETTY_NAMES:
        return PRETTY_NAMES[col]
    if col.startswith("department_"):
        return f"Department: {col.split('_', 1)[1]}"
    if col.startswith("performance_trend_"):
        return f"Trend: {col.split('_', 2)[2]}"
    return col


def build_feature_row(data: dict, feature_names: list[str]) -> pd.DataFrame:
    row = {field: float(data[field]) for field in RAW_NUMERIC_FIELDS}

    for dep in DEPARTMENTS:
        col = f"department_{dep}"
        if col in feature_names:
            row[col] = 1 if dep == data["department"] else 0
    for tr in TRENDS:
        col = f"performance_trend_{tr}"
        if col in feature_names:
            row[col] = 1 if tr == data["performance_trend"] else 0

    ordered = {name: row.get(name, 0) for name in feature_names}
    return pd.DataFrame([ordered])


def _shap_values_for_predicted_class(explainer, X_row, predicted_class_idx: int) -> np.ndarray:
    """Normalizes SHAP's several possible output shapes across versions/
    model types into a single 1D array of per-feature contributions for
    whichever class the model actually predicted."""
    raw = explainer.shap_values(X_row)

    if isinstance(raw, list):
        # One array per class: each shaped (n_samples, n_features)
        return np.asarray(raw[predicted_class_idx])[0]

    arr = np.asarray(raw)
    if arr.ndim == 3:
        # (n_samples, n_features, n_classes)
        return arr[0, :, predicted_class_idx]
    # Binary / regression case: (n_samples, n_features)
    return arr[0]


def explain_prediction(target: str, X_row: pd.DataFrame, X_model_input,
                        feature_names: list[str], predicted_class_idx: int, top_n: int = 5) -> list[dict]:
    """
    X_row:         original-scale feature values, shown to the user.
    X_model_input: whatever the model was actually trained on -- same as
                    X_row for tree models, StandardScaler-transformed for
                    Logistic Regression. SHAP is computed on X_model_input
                    (so it matches what the model saw) but displayed
                    against X_row (so a person reads real numbers, not
                    z-scores).
    """
    explainer = registry.explainers.get(target)

    if explainer is not None:
        try:
            shap_vals = _shap_values_for_predicted_class(explainer, X_model_input, predicted_class_idx)
            order = np.argsort(np.abs(shap_vals))[::-1][:top_n]
            return [
                {
                    "feature": pretty_name(feature_names[i]),
                    "value": float(X_row.iloc[0][feature_names[i]]),
                    "impact": round(float(shap_vals[i]), 4),
                }
                for i in order
            ]
        except Exception as exc:  # pragma: no cover - fall back gracefully
            print(f"[warning] SHAP explanation failed for '{target}': {exc}")

    # Fallback if no explainer loaded: built-in global feature_importances_
    # (trees) or |coefficient| (linear model) -- no signed, per-prediction
    # direction available either way, just a ranking of what matters.
    model = registry.bundles[target]["model"]
    importances = getattr(model, "feature_importances_", None)
    if importances is None:
        coef = getattr(model, "coef_", None)
        importances = np.abs(coef).mean(axis=0) if coef is not None else None
    if importances is None:
        return []
    order = np.argsort(importances)[::-1][:top_n]
    return [
        {
            "feature": pretty_name(feature_names[i]),
            "value": float(X_row.iloc[0][feature_names[i]]),
            "impact": None,
        }
        for i in order
    ]


def predict_one_target(target: str, data: dict) -> dict:
    bundle = registry.bundles[target]
    model = bundle["model"]
    feature_names = bundle["feature_names"]
    label_encoder = bundle.get("label_encoder")
    scaler = bundle.get("scaler")  # only present when Logistic Regression won this target

    X_row = build_feature_row(data, feature_names)
    X_model_input = scaler.transform(X_row) if scaler is not None else X_row
    pred = model.predict(X_model_input)[0]

    confidence = None
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X_model_input)[0]
        confidence = float(np.max(proba))

    predicted_class_idx = int(pred)
    label = label_encoder.inverse_transform([pred])[0] if label_encoder is not None else (
        "Yes" if predicted_class_idx == 1 else "No"
    )

    top_features = explain_prediction(target, X_row, X_model_input, feature_names, predicted_class_idx)

    return {
        "prediction": str(label),
        "confidence": confidence,
        "top_features": top_features,
    }


def predict_all(data: dict) -> dict[str, dict]:
    """Runs every loaded target model against one employee's data."""
    return {target: predict_one_target(target, data) for target in registry.available_targets()}
