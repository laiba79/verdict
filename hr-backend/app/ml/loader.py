"""
Loads the trained model bundles once at startup and keeps them (plus a
SHAP TreeExplainer per model) in memory. Building a SHAP explainer has a
non-trivial one-time cost, so we do it once here instead of per-request --
that's what makes real SHAP explanations fast enough to serve live.
"""

import os
import joblib
import shap

from app.config import get_settings

settings = get_settings()

TARGET_FILES = {
    "salary_change": "salary_change_model.joblib",
    "wfh_allowed": "wfh_allowed_model.joblib",
    "must_work_saturday": "must_work_saturday_model.joblib",
}
# Older runs may have saved the Saturday model under its old name.
FALLBACK_FILES = {
    "must_work_saturday": "saturday_leave_approved_model.joblib",
}


class ModelRegistry:
    def __init__(self):
        self.bundles: dict[str, dict] = {}
        self.explainers: dict[str, shap.TreeExplainer] = {}

    def load(self):
        models_dir = settings.MODELS_DIR
        for target, fname in TARGET_FILES.items():
            path = os.path.join(models_dir, fname)
            if not os.path.exists(path) and target in FALLBACK_FILES:
                path = os.path.join(models_dir, FALLBACK_FILES[target])

            if not os.path.exists(path):
                print(f"[warning] model file not found for target '{target}': {path}")
                continue

            bundle = joblib.load(path)
            self.bundles[target] = bundle

            try:
                # Which explainer class works depends on the model family
                # that won the benchmark for this target (see
                # scripts/train_models.py) -- trees get the fast exact
                # TreeExplainer; a linear model needs LinearExplainer plus
                # the small background sample saved alongside it.
                if bundle.get("model_type") == "LogisticRegression":
                    background = bundle.get("shap_background")
                    if background is not None:
                        self.explainers[target] = shap.LinearExplainer(bundle["model"], background)
                else:
                    self.explainers[target] = shap.TreeExplainer(bundle["model"])
            except Exception as exc:  # pragma: no cover - defensive
                print(f"[warning] could not build SHAP explainer for '{target}': {exc}")

        return self

    def available_targets(self) -> list[str]:
        return list(self.bundles.keys())

    def is_ready(self) -> bool:
        return len(self.bundles) > 0


# Single shared instance, populated on app startup (see app/main.py)
registry = ModelRegistry()
