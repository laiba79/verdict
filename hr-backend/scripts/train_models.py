"""
Step 2: Train the three HR decision models
---------------------------------------------
1. salary_change (multiclass: decrease / no_change / increase)
2. wfh_allowed (binary)
3. must_work_saturday (binary)

For each target we now benchmark FOUR model variants instead of two:
    Logistic Regression (linear baseline, class_weight="balanced")
    Random Forest        (class_weight="balanced")
    XGBoost               (baseline, no weighting -- kept for comparison)
    XGBoost               (balanced, via sample_weight)          <- actual candidate

For each target we:
- split train/val/test (60/20/20), stratified
- train all four model variants (the XGBoost pair uses the val set for early stopping)
- pick the best CANDIDATE (LR / RF / XGB-balanced) using VALIDATION macro F1
  -- XGB-baseline is trained only to quantify the effect of class-imbalance
  handling, it's never eligible to be picked as best
- evaluate the chosen model on the held-out TEST set exactly once for the
  "official" score, then evaluate every trained variant on test too so the
  benchmark report can show a full comparison table (this second pass is
  for reporting only -- it has zero influence on which model was picked)
- save the best model + a SHAP summary plot, same as before
- run a department-level fairness audit on the best model's test predictions

Outputs (all under hr-backend/outputs/):
    models/<target>_model.joblib     - unchanged from before
    plots/shap_<target>.png          - unchanged from before
    benchmark_results.json           - full numeric comparison, all models x all targets
    benchmark_report.md              - same, formatted as a readable table (screenshot-able)
    fairness_report.json / .md       - department-level demographic parity / disparate impact audit
"""

import json
import os
import sys

import pandas as pd
import numpy as np
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
import xgboost as xgb
import shap

# Resolve paths relative to THIS script's location, not whatever directory
# the user happened to run `python` from. This means `python train_models.py`,
# `python scripts/train_models.py`, and running from VS Code's "Run" button
# all work identically, instead of silently depending on cwd.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, BACKEND_DIR)  # so `from app.ml.fairness import ...` works run from anywhere

from app.ml.fairness import build_fairness_audit  # noqa: E402

DATA_PATH = os.path.join(BACKEND_DIR, "data", "hr_employee_performance_dataset.csv")
MODELS_DIR = os.path.join(BACKEND_DIR, "outputs", "models")
PLOTS_DIR = os.path.join(BACKEND_DIR, "outputs", "plots")
OUTPUTS_DIR = os.path.join(BACKEND_DIR, "outputs")

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(PLOTS_DIR, exist_ok=True)

# ---------------------------------------------------------
# Load data
# ---------------------------------------------------------
df = pd.read_csv(DATA_PATH)

# Features used for prediction - deliberately EXCLUDE:
# - employee_id (identifier, not predictive)
# - performance_score (this is a derived composite that basically leaks the label -
#   in a real system you'd keep it, but here it's so directly tied to our rule-based
#   labels that including it would make the problem trivially easy and hide whether
#   the model can learn from the underlying behavioral signals)
# - department is used as a MODEL FEATURE (one-hot below) AND, separately,
#   kept as the group attribute for the fairness audit -- see `dept` below.
# - the other two target columns (can't use one target to predict another here)
feature_cols = [
    "tenure_years", "current_salary", "attendance_pct", "avg_login_delay_min",
    "tasks_assigned", "tasks_completed_on_time", "task_completion_rate",
    "quality_score", "manager_rating", "peer_rating", "overtime_hours_month",
    "past_leave_requests", "past_leave_approved_rate",
]
categorical_cols = ["department", "performance_trend"]

X = pd.get_dummies(df[feature_cols + categorical_cols], columns=categorical_cols, drop_first=True)
dept = df["department"]  # kept aligned to X by index, used only for the fairness audit

targets = {
    "salary_change": {"type": "multiclass", "col": "salary_change"},
    "wfh_allowed": {"type": "binary", "col": "wfh_allowed"},
    "must_work_saturday": {"type": "binary", "col": "must_work_saturday"},
}

results_summary = []       # one row per target: the model that actually got shipped
benchmark_rows = []        # one row per (target, model variant): for the comparison report
fairness_predictions = {}  # {target: predictions from the SHIPPED model, aligned to X_test}
dept_test_by_target = {}   # {target: department series aligned to that target's X_test}

for target_name, cfg in targets.items():
    print("\n" + "=" * 70)
    print(f"TARGET: {target_name}")
    print("=" * 70)

    y_raw = df[cfg["col"]]

    if cfg["type"] == "multiclass":
        le = LabelEncoder()
        y = le.fit_transform(y_raw)
        class_names = le.classes_
    else:
        le = None
        y = y_raw
        class_names = ["0", "1"]

    # ---------------------------------------------------------
    # 3-way split: 60% train / 20% val / 20% test
    # stratify=y at each step keeps class proportions consistent across all 3 sets.
    # `dept` is split alongside X/y (same indices) purely so we can run the
    # fairness audit on the test set later without re-joining on employee_id.
    # ---------------------------------------------------------
    X_temp, X_test, y_temp, y_test, dept_temp, dept_test = train_test_split(
        X, y, dept, test_size=0.2, random_state=42, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=0.125, random_state=42, stratify=y_temp
    )
    print(f"Split sizes -> train: {len(X_train)}, val: {len(X_val)}, test: {len(X_test)}")
    dept_test_by_target[target_name] = dept_test

    class_report_names = [str(c) for c in class_names]

    def macro_f1(model, X_, y_):
        return f1_score(y_, model.predict(X_), average="macro")

    # --- 1. Logistic Regression baseline -------------------------------
    # Linear model, features standardized first (unlike trees, LR is
    # sensitive to feature scale -- current_salary is on a totally
    # different scale than e.g. attendance_pct otherwise). This exists to
    # answer "is a much simpler/cheaper model already good enough?" -- a
    # question every ML report should be able to answer, not just assumed.
    log_reg = Pipeline([
        ("scale", StandardScaler()),
        ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)),
    ])
    log_reg.fit(X_train, y_train)
    lr_val_f1 = macro_f1(log_reg, X_val, y_val)

    # --- 2. Random Forest -----------------------------------------------
    # RF doesn't use a validation set for early stopping (it doesn't build trees
    # sequentially, so there's nothing to "stop early" - each tree is independent).
    rf = RandomForestClassifier(
        n_estimators=600, max_depth=8, min_samples_leaf=5,
        class_weight="balanced", random_state=42, n_jobs=-1
    )
    rf.fit(X_train, y_train)
    rf_val_f1 = macro_f1(rf, X_val, y_val)

    # --- 3a. XGBoost, NO imbalance handling (kept only for comparison) --
    xgb_base = xgb.XGBClassifier(
        n_estimators=300, max_depth=5, learning_rate=0.05,
        eval_metric="mlogloss" if cfg["type"] == "multiclass" else "logloss",
        early_stopping_rounds=20,
        random_state=42, n_jobs=-1,
    )
    xgb_base.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    xgb_base_val_f1 = macro_f1(xgb_base, X_val, y_val)

    # --- 3b. XGBoost, BALANCED via per-sample weights --------------------
    # scale_pos_weight only handles binary imbalance; compute_sample_weight
    # with class_weight="balanced" generalizes the same idea (inverse class
    # frequency) to both the binary AND multiclass targets, so one approach
    # covers all three targets instead of branching per target type.
    sample_weight = compute_sample_weight(class_weight="balanced", y=y_train)
    xgb_balanced = xgb.XGBClassifier(
        n_estimators=300, max_depth=5, learning_rate=0.05,
        eval_metric="mlogloss" if cfg["type"] == "multiclass" else "logloss",
        early_stopping_rounds=20,
        random_state=42, n_jobs=-1,
    )
    xgb_balanced.fit(
        X_train, y_train,
        sample_weight=sample_weight,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )
    xgb_balanced_val_f1 = macro_f1(xgb_balanced, X_val, y_val)

    print(f"\n[VALIDATION macro F1] LogReg: {lr_val_f1:.3f} | RF: {rf_val_f1:.3f} | "
          f"XGB (no weighting): {xgb_base_val_f1:.3f} | XGB (balanced): {xgb_balanced_val_f1:.3f}")

    # Pick the best CANDIDATE using VALIDATION performance only (never test).
    # XGB-baseline is deliberately excluded -- it exists purely to quantify
    # the benefit of the balancing step below, not to be shipped.
    candidates = {"LogisticRegression": (log_reg, lr_val_f1),
                  "RandomForest": (rf, rf_val_f1),
                  "XGBoost (balanced)": (xgb_balanced, xgb_balanced_val_f1)}
    best_name, (best_model, best_val_f1) = max(candidates.items(), key=lambda kv: kv[1][1])
    print(f">> Best model for {target_name} (chosen using val set): {best_name}")

    # ---------------------------------------------------------
    # NOW, and only now, touch the test set for the shipped model's official score
    # ---------------------------------------------------------
    best_preds = best_model.predict(X_test)
    best_test_f1 = f1_score(y_test, best_preds, average="macro")

    print(f"\n[TEST] {best_name} - Accuracy: {accuracy_score(y_test, best_preds):.3f}, "
          f"Macro F1: {best_test_f1:.3f}")
    print(classification_report(y_test, best_preds, target_names=class_report_names))

    cm = confusion_matrix(y_test, best_preds)
    print(f"Confusion Matrix ({best_name}, test set):\n{cm}")

    # Save model (unwrap the Pipeline's classifier if LR won, so
    # predictor.py's `bundle["model"]` always has a plain sklearn/xgboost
    # estimator -- SHAP's TreeExplainer specifically needs that, and the
    # live prediction API doesn't need to care which model type won).
    model_to_save = best_model.named_steps["clf"] if best_name == "LogisticRegression" else best_model
    scaler_to_save = best_model.named_steps["scale"] if best_name == "LogisticRegression" else None
    # SHAP's LinearExplainer needs a small background sample to estimate
    # feature means against -- only needed (and only saved) if LR wins.
    shap_background = None
    if best_name == "LogisticRegression":
        bg_sample = X_train.sample(min(100, len(X_train)), random_state=42)
        shap_background = scaler_to_save.transform(bg_sample)
    model_path = os.path.join(MODELS_DIR, f"{target_name}_model.joblib")
    joblib.dump({
        "model": model_to_save,
        "model_type": best_name,
        "scaler": scaler_to_save,
        "shap_background": shap_background,
        "feature_names": list(X.columns),
        "label_encoder": le,
    }, model_path)
    print(f"Saved model to {model_path}")

    # --- SHAP explainability ---
    # TreeExplainer only works for RF/XGBoost. If Logistic Regression wins
    # on a target, fall back to LinearExplainer instead of crashing --
    # SHAP supports both, just with different explainer classes per model
    # family, and the live API (loader.py) mirrors this same fallback.
    if best_name == "LogisticRegression":
        X_test_for_shap = scaler_to_save.transform(X_test)
        explainer = shap.LinearExplainer(model_to_save, scaler_to_save.transform(X_train))
        shap_values = explainer.shap_values(X_test_for_shap)
    else:
        explainer = shap.TreeExplainer(model_to_save)
        shap_values = explainer.shap_values(X_test)

    plt.figure()
    if cfg["type"] == "multiclass" and isinstance(shap_values, list):
        shap.summary_plot(shap_values, X_test, class_names=class_names, show=False)
    else:
        shap.summary_plot(shap_values, X_test, show=False)
    plt.tight_layout()
    plot_path = os.path.join(PLOTS_DIR, f"shap_{target_name}.png")
    plt.savefig(plot_path, dpi=120, bbox_inches="tight")
    plt.close()
    print(f"Saved SHAP plot to {plot_path}")

    results_summary.append({
        "target": target_name,
        "best_model": best_name,
        "val_macro_f1": round(float(best_val_f1), 4),
        "test_accuracy": round(float(accuracy_score(y_test, best_preds)), 4),
        "test_macro_f1": round(float(best_test_f1), 4),
    })

    # Predictions from the SHIPPED model, for the fairness audit later.
    # Multiclass predictions are decoded back to label strings (increase/
    # no_change/decrease) so the fairness report reads the same way the
    # rest of the app does, instead of raw encoded ints.
    fairness_predictions[target_name] = le.inverse_transform(best_preds) if le is not None else best_preds

    # ---------------------------------------------------------
    # Benchmark table rows -- ALL FOUR trained variants, test-set metrics,
    # for reporting only. Model selection above already happened using
    # validation data alone; this second, test-set pass never feeds back
    # into which model got shipped.
    # ---------------------------------------------------------
    for variant_name, variant_model in [
        ("LogisticRegression", log_reg),
        ("RandomForest", rf),
        ("XGBoost (no weighting)", xgb_base),
        ("XGBoost (balanced)", xgb_balanced),
    ]:
        variant_preds = variant_model.predict(X_test)
        benchmark_rows.append({
            "target": target_name,
            "model": variant_name,
            "shipped": bool(variant_name == best_name),
            "test_accuracy": round(float(accuracy_score(y_test, variant_preds)), 4),
            "test_macro_f1": round(float(f1_score(y_test, variant_preds, average="macro")), 4),
            "test_per_class_f1": {
                class_report_names[i]: round(float(s), 4)
                for i, s in enumerate(f1_score(y_test, variant_preds, average=None, labels=sorted(np.unique(y))))
            },
        })

print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)
summary_df = pd.DataFrame(results_summary)
print(summary_df.to_string(index=False))

# ===========================================================
# Benchmark report (JSON + Markdown) -- comparison across all 4 model
# variants x all 3 targets, plus an explicit before/after class-imbalance
# callout for salary_change (the one target with real imbalance: only
# ~10% of rows are "decrease").
# ===========================================================
xgb_before = next(r for r in benchmark_rows if r["target"] == "salary_change" and r["model"] == "XGBoost (no weighting)")
xgb_after = next(r for r in benchmark_rows if r["target"] == "salary_change" and r["model"] == "XGBoost (balanced)")
minority_class = "decrease"
imbalance_delta = {
    "target": "salary_change",
    "minority_class": minority_class,
    "minority_class_share_of_data": round(float((df["salary_change"] == minority_class).mean()), 4),
    "xgboost_no_weighting_minority_f1": xgb_before["test_per_class_f1"].get(minority_class),
    "xgboost_balanced_minority_f1": xgb_after["test_per_class_f1"].get(minority_class),
    "xgboost_no_weighting_macro_f1": xgb_before["test_macro_f1"],
    "xgboost_balanced_macro_f1": xgb_after["test_macro_f1"],
}

with open(os.path.join(OUTPUTS_DIR, "benchmark_results.json"), "w") as f:
    json.dump({
        "shipped_models": results_summary,
        "all_variants": benchmark_rows,
        "class_imbalance_handling": imbalance_delta,
    }, f, indent=2)

md_lines = ["# Model Benchmark Report", ""]
md_lines.append("Four model variants trained per target. **Model selection uses validation "
                 "macro-F1 only**; test-set numbers below are for comparison/reporting and never "
                 "influenced which model shipped.\n")
for target_name in targets:
    md_lines.append(f"## {target_name}")
    md_lines.append("")
    md_lines.append("| Model | Test Accuracy | Test Macro F1 | Shipped |")
    md_lines.append("|---|---|---|---|")
    for row in [r for r in benchmark_rows if r["target"] == target_name]:
        mark = "YES" if row["shipped"] else ""
        md_lines.append(f"| {row['model']} | {row['test_accuracy']:.3f} | {row['test_macro_f1']:.3f} | {mark} |")
    md_lines.append("")

md_lines.append("## Class imbalance handling (salary_change)")
md_lines.append("")
md_lines.append(f"`salary_change = decrease` is only **{imbalance_delta['minority_class_share_of_data']:.1%}** "
                 "of the dataset -- the model can score well on accuracy alone while barely learning "
                 "this class. Per-sample class weighting (`compute_sample_weight('balanced', ...)`) "
                 "was applied to XGBoost to correct for this:\n")
md_lines.append("| | No weighting | Balanced |")
md_lines.append("|---|---|---|")
md_lines.append(f"| Macro F1 (all classes) | {imbalance_delta['xgboost_no_weighting_macro_f1']:.3f} | "
                 f"{imbalance_delta['xgboost_balanced_macro_f1']:.3f} |")
md_lines.append(f"| F1 on minority class ('decrease') | {imbalance_delta['xgboost_no_weighting_minority_f1']:.3f} | "
                 f"{imbalance_delta['xgboost_balanced_minority_f1']:.3f} |")
md_lines.append("")

with open(os.path.join(OUTPUTS_DIR, "benchmark_report.md"), "w") as f:
    f.write("\n".join(md_lines))

print("\nSaved benchmark report to outputs/benchmark_results.json and outputs/benchmark_report.md")

# ===========================================================
# Fairness audit -- department-level demographic parity / disparate
# impact, run on the SHIPPED model's predictions on each target's own
# test set. Each target was split independently (different test sets),
# so each is audited against its own department slice.
# ===========================================================
fairness_reports = {}
for target_name in targets:
    single_target_audit = build_fairness_audit(
        df=pd.DataFrame({"department": dept_test_by_target[target_name].values}),
        predictions={target_name: fairness_predictions[target_name]},
        group_col="department",
    )
    fairness_reports[target_name] = single_target_audit["reports"][target_name]

fairness_audit = {
    "group_col": "department",
    "note": (
        "Audited against 'department' because the dataset has no gender/age/ethnicity "
        "field. Methodology (demographic parity difference + four-fifths disparate impact "
        "rule) is identical for any protected attribute."
    ),
    "reports": fairness_reports,
}

with open(os.path.join(OUTPUTS_DIR, "fairness_report.json"), "w") as f:
    json.dump(fairness_audit, f, indent=2)

fair_md = ["# Fairness Audit Report", "", fairness_audit["note"], ""]
for target_name, report in fairness_reports.items():
    fair_md.append(f"## {target_name}")
    fair_md.append("")
    if "per_class" in report:  # multiclass
        for cls, cls_report in report["per_class"].items():
            flag = "FLAGGED" if cls_report.get("flagged") else "OK"
            md_dpd = cls_report.get("demographic_parity_difference")
            md_dir = cls_report.get("disparate_impact_ratio")
            fair_md.append(f"- **{target_name} = {cls}**: DPD = {md_dpd}, DIR = {md_dir} -- {flag}")
    else:  # binary
        flag = "FLAGGED" if report.get("flagged") else "OK"
        fair_md.append(f"- DPD = {report.get('demographic_parity_difference')}, "
                        f"DIR = {report.get('disparate_impact_ratio')} -- {flag}")
        fair_md.append("")
        fair_md.append("  Selection rates by department:")
        for dept_name, rate in (report.get("selection_rates") or {}).items():
            fair_md.append(f"  - {dept_name}: {rate:.1%}")
    fair_md.append("")

with open(os.path.join(OUTPUTS_DIR, "fairness_report.md"), "w") as f:
    f.write("\n".join(fair_md))

print("Saved fairness audit to outputs/fairness_report.json and outputs/fairness_report.md")
