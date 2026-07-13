"""
HR Decision System — Command Line Demo
-----------------------------------------
Loads the 3 trained models and asks you to type in one employee's
stats right in the terminal, then prints out what the system
recommends for:
    1) Salary change (increase / no_change / decrease)
    2) Work From Home allowed (yes / no)
    3) Must work Saturday (yes / no)

Run with:
    cd scripts
    python predict_cli.py
"""

import os
import sys
import joblib
import numpy as np
import pandas as pd

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "outputs", "models")

DEPARTMENTS = ["Engineering", "Sales", "Marketing", "HR", "Finance", "Support"]
TRENDS = ["improving", "stable", "declining"]

TARGET_FILES = {
    "salary_change": "salary_change_model.joblib",
    "wfh_allowed": "wfh_allowed_model.joblib",
    "must_work_saturday": "must_work_saturday_model.joblib",
}
FALLBACK_FILES = {
    "must_work_saturday": "saturday_leave_approved_model.joblib",
}

TARGET_LABELS = {
    "salary_change": "Salary Change",
    "wfh_allowed": "Work From Home Allowed",
    "must_work_saturday": "Must Work Saturday",
}


def load_models():
    loaded = {}
    for target, fname in TARGET_FILES.items():
        path = os.path.join(MODELS_DIR, fname)
        if not os.path.exists(path) and target in FALLBACK_FILES:
            path = os.path.join(MODELS_DIR, FALLBACK_FILES[target])
        if os.path.exists(path):
            loaded[target] = joblib.load(path)
        else:
            print(f"[warning] could not find model file for '{target}' at {path}")
    return loaded


def ask_float(prompt, default):
    raw = input(f"{prompt} [{default}]: ").strip()
    if raw == "":
        return float(default)
    try:
        return float(raw)
    except ValueError:
        print("  Not a number, using default.")
        return float(default)


def ask_int(prompt, default):
    return int(ask_float(prompt, default))


def ask_choice(prompt, options, default):
    print(f"{prompt} options: {', '.join(options)}")
    raw = input(f"  choose [{default}]: ").strip()
    if raw == "":
        return default
    # allow partial / case-insensitive matches
    for opt in options:
        if raw.lower() == opt.lower():
            return opt
    print(f"  Didn't recognize that, using default ({default}).")
    return default


def collect_employee_input():
    print("\n--- Enter Employee Data (press Enter to accept the default shown) ---\n")

    data = {}
    data["department"] = ask_choice("Department", DEPARTMENTS, "Engineering")
    data["performance_trend"] = ask_choice("Performance trend", TRENDS, "stable")

    data["tenure_years"] = ask_float("Tenure (years)", 3)
    data["current_salary"] = ask_float("Current salary", 70000)
    data["attendance_pct"] = ask_float("Attendance %", 92)
    data["avg_login_delay_min"] = ask_float("Avg login delay (minutes)", 8)
    data["tasks_assigned"] = ask_int("Tasks assigned", 20)
    data["tasks_completed_on_time"] = ask_int("Tasks completed on time", 16)
    data["task_completion_rate"] = ask_float("Task completion rate (0-1)", 0.80)
    data["quality_score"] = ask_float("Quality score (0-100)", 75)
    data["manager_rating"] = ask_float("Manager rating (1-5)", 3.5)
    data["peer_rating"] = ask_float("Peer rating (1-5)", 3.5)
    data["overtime_hours_month"] = ask_float("Overtime hours / month", 5)
    data["past_leave_requests"] = ask_int("Past leave requests", 2)
    data["past_leave_approved_rate"] = ask_float("Past leave approval rate (0-1)", 0.70)

    return data


def build_feature_row(data, feature_names):
    row = {k: v for k, v in data.items() if k in feature_names}

    for dep in DEPARTMENTS:
        col = f"department_{dep}"
        if col in feature_names:
            row[col] = 1 if data["department"] == dep else 0

    for tr in TRENDS:
        col = f"performance_trend_{tr}"
        if col in feature_names:
            row[col] = 1 if data["performance_trend"] == tr else 0

    ordered = {name: row.get(name, 0) for name in feature_names}
    return pd.DataFrame([ordered])


def pretty_name(col):
    mapping = {
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
    if col in mapping:
        return mapping[col]
    if col.startswith("department_"):
        return f"Department: {col.split('_', 1)[1]}"
    if col.startswith("performance_trend_"):
        return f"Trend: {col.split('_', 2)[2]}"
    return col


def explain_top_features(model, X_row, feature_names, top_n=4):
    try:
        importances = model.feature_importances_
    except AttributeError:
        return []
    order = np.argsort(importances)[::-1][:top_n]
    return [(pretty_name(feature_names[i]), X_row.iloc[0][feature_names[i]]) for i in order]


def predict_all(loaded_models, data):
    results = {}
    for target, bundle in loaded_models.items():
        model = bundle["model"]
        feature_names = bundle["feature_names"]
        label_encoder = bundle.get("label_encoder")

        X_row = build_feature_row(data, feature_names)
        pred = model.predict(X_row)[0]

        confidence = None
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(X_row)[0]
            confidence = float(np.max(proba))

        label = label_encoder.inverse_transform([pred])[0] if label_encoder is not None else (
            "Yes" if int(pred) == 1 else "No"
        )

        results[target] = {
            "label": str(label),
            "confidence": confidence,
            "top_features": explain_top_features(model, X_row, feature_names),
        }
    return results


def print_results(results):
    print("\n" + "=" * 60)
    print("SYSTEM RECOMMENDATION")
    print("=" * 60)
    for target, info in results.items():
        title = TARGET_LABELS.get(target, target)
        conf_str = f"  ({info['confidence']*100:.0f}% confidence)" if info["confidence"] is not None else ""
        print(f"\n{title}: {info['label']}{conf_str}")
        if info["top_features"]:
            print("  Top factors behind this decision:")
            for name, value in info["top_features"]:
                val_str = f"{value:.2f}" if isinstance(value, float) else str(value)
                print(f"    - {name}: {val_str}")
    print("\n" + "=" * 60)
    print("Note: 'Must Work Saturday' confidence can look artificially perfect")
    print("(~100%) because it was trained on a clean rule-based threshold.")
    print("=" * 60 + "\n")


def main():
    print("Loading trained models...")
    loaded_models = load_models()
    if not loaded_models:
        print("No models found. Make sure you've run train_models.py first.")
        sys.exit(1)
    print(f"Loaded: {', '.join(loaded_models.keys())}")

    while True:
        data = collect_employee_input()
        results = predict_all(loaded_models, data)
        print_results(results)

        again = input("Predict another employee? (y/n) [y]: ").strip().lower()
        if again == "n":
            print("Goodbye!")
            break


if __name__ == "__main__":
    main()