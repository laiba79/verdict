"""
HR Decision System — Web Dashboard
------------------------------------
A simple Flask app that loads the 3 trained models (salary_change,
wfh_allowed, must_work_saturday) and lets you enter one employee's
data in a form to see what the system would recommend, with a
plain-language explanation of the top reasons behind each prediction.

Run with:
    cd scripts
    python app.py

Then open the printed URL (usually http://127.0.0.1:5000) in your browser.
"""

import os
import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "outputs", "models")

DEPARTMENTS = ["Engineering", "Sales", "Marketing", "HR", "Finance", "Support"]
TRENDS = ["improving", "stable", "declining"]

TARGET_FILES = {
    "salary_change": "salary_change_model.joblib",
    "wfh_allowed": "wfh_allowed_model.joblib",
    "must_work_saturday": "must_work_saturday_model.joblib",
}

# Some older runs may have saved the Saturday model under its old name.
FALLBACK_FILES = {
    "must_work_saturday": "saturday_leave_approved_model.joblib",
}

_loaded = {}


def load_models():
    """Load all available trained models into memory once at startup."""
    for target, fname in TARGET_FILES.items():
        path = os.path.join(MODELS_DIR, fname)
        if not os.path.exists(path) and target in FALLBACK_FILES:
            path = os.path.join(MODELS_DIR, FALLBACK_FILES[target])
        if os.path.exists(path):
            _loaded[target] = joblib.load(path)
        else:
            print(f"[warning] model file not found for target '{target}': {path}")
    return _loaded


def build_feature_row(form, feature_names):
    """Turn the submitted form into a single-row DataFrame matching the
    exact columns the model was trained on (including one-hot dummy
    columns), filling anything missing with 0."""
    raw = {
        "tenure_years": float(form["tenure_years"]),
        "current_salary": float(form["current_salary"]),
        "attendance_pct": float(form["attendance_pct"]),
        "avg_login_delay_min": float(form["avg_login_delay_min"]),
        "tasks_assigned": float(form["tasks_assigned"]),
        "tasks_completed_on_time": float(form["tasks_completed_on_time"]),
        "task_completion_rate": float(form["task_completion_rate"]),
        "quality_score": float(form["quality_score"]),
        "manager_rating": float(form["manager_rating"]),
        "peer_rating": float(form["peer_rating"]),
        "overtime_hours_month": float(form["overtime_hours_month"]),
        "past_leave_requests": float(form["past_leave_requests"]),
        "past_leave_approved_rate": float(form["past_leave_approved_rate"]),
    }

    department = form["department"]
    trend = form["performance_trend"]

    row = dict(raw)
    for dep in DEPARTMENTS:
        col = f"department_{dep}"
        if col in feature_names:
            row[col] = 1 if dep == department else 0
    for tr in TRENDS:
        col = f"performance_trend_{tr}"
        if col in feature_names:
            row[col] = 1 if tr == trend else 0

    # Build in the exact column order the model expects.
    ordered = {name: row.get(name, 0) for name in feature_names}
    return pd.DataFrame([ordered])


def explain_top_features(model, X_row, feature_names, top_n=4):
    """Lightweight explanation using the model's built-in feature
    importances (fast, no SHAP dependency needed at request time)."""
    try:
        importances = model.feature_importances_
    except AttributeError:
        return []
    order = np.argsort(importances)[::-1][:top_n]
    readable = []
    for idx in order:
        name = feature_names[idx]
        value = X_row.iloc[0][name]
        readable.append({"feature": pretty_name(name), "value": value})
    return readable


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
        return f"Trend: {col.split('_', 2)[2] if col.count('_') > 1 else col}"
    return col


@app.route("/")
def index():
    return render_template_string(INDEX_HTML, departments=DEPARTMENTS, trends=TRENDS)


@app.route("/predict", methods=["POST"])
def predict():
    form = request.json
    results = {}

    for target, bundle in _loaded.items():
        model = bundle["model"]
        feature_names = bundle["feature_names"]
        label_encoder = bundle.get("label_encoder")

        X_row = build_feature_row(form, feature_names)
        pred = model.predict(X_row)[0]

        # Probability / confidence if the model supports it
        confidence = None
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(X_row)[0]
            confidence = float(np.max(proba))

        if label_encoder is not None:
            label = label_encoder.inverse_transform([pred])[0]
        else:
            label = "Yes" if int(pred) == 1 else "No"

        results[target] = {
            "prediction": str(label),
            "confidence": confidence,
            "top_features": explain_top_features(model, X_row, feature_names),
        }

    return jsonify(results)


INDEX_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>HR Decision Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --pink: #f6a5c0;
    --pink-dark: #e77fa3;
    --purple: #b98ee0;
    --purple-dark: #9a5fd0;
    --bg: #fff6fa;
    --card: #ffffff;
    --text: #4a3550;
    --muted: #8a7690;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, sans-serif;
    background: linear-gradient(160deg, #fff6fa 0%, #f3e8ff 100%);
    color: var(--text);
    margin: 0;
    padding: 32px 16px 60px;
  }
  h1 {
    text-align: center;
    color: var(--purple-dark);
    font-size: 2rem;
    margin-bottom: 4px;
  }
  p.subtitle {
    text-align: center;
    color: var(--muted);
    margin-top: 0;
    margin-bottom: 32px;
  }
  .layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
    max-width: 1100px;
    margin: 0 auto;
  }
  @media (min-width: 900px) {
    .layout { grid-template-columns: 1fr 1fr; }
  }
  .card {
    background: var(--card);
    border-radius: 18px;
    padding: 24px 28px;
    box-shadow: 0 8px 24px rgba(180, 120, 180, 0.12);
    border: 1px solid #f3d9e8;
  }
  .card h2 {
    color: var(--pink-dark);
    margin-top: 0;
    font-size: 1.2rem;
    border-bottom: 2px dashed #f6d3e4;
    padding-bottom: 8px;
  }
  label {
    display: block;
    font-size: 0.85rem;
    color: var(--muted);
    margin-top: 14px;
    margin-bottom: 4px;
  }
  input, select {
    width: 100%;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1.5px solid #eccbe0;
    font-size: 0.95rem;
    background: #fffafd;
    color: var(--text);
  }
  input:focus, select:focus {
    outline: none;
    border-color: var(--purple);
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 16px;
  }
  button {
    margin-top: 22px;
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--pink) 0%, var(--purple) 100%);
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  button:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(180,120,180,0.3); }
  button:disabled { opacity: 0.6; cursor: not-allowed; }

  .result-card {
    border-radius: 16px;
    padding: 16px 18px;
    margin-bottom: 14px;
    background: #fff2f8;
    border: 1px solid #f6d3e4;
  }
  .result-card h3 {
    margin: 0 0 6px;
    font-size: 1rem;
    color: var(--purple-dark);
  }
  .badge {
    display: inline-block;
    padding: 4px 14px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.95rem;
    color: white;
    background: var(--purple);
  }
  .conf {
    font-size: 0.8rem;
    color: var(--muted);
    margin-left: 8px;
  }
  .why {
    margin-top: 10px;
    font-size: 0.82rem;
    color: var(--muted);
  }
  .why ul { margin: 4px 0 0; padding-left: 18px; }
  #resultsPlaceholder {
    color: var(--muted);
    font-style: italic;
    font-size: 0.9rem;
  }
  .footnote {
    font-size: 0.75rem;
    color: var(--muted);
    margin-top: 18px;
    line-height: 1.4;
  }
</style>
</head>
<body>

<h1> HR Decision Dashboard</h1>
<p class="subtitle">Enter one employee's monthly stats to see what the system recommends</p>

<div class="layout">
  <div class="card">
    <h2>Employee Data</h2>
    <form id="predictForm">
      <div class="grid-2">
        <div>
          <label>Department</label>
          <select name="department">
            {% for d in departments %}<option value="{{d}}">{{d}}</option>{% endfor %}
          </select>
        </div>
        <div>
          <label>Performance Trend</label>
          <select name="performance_trend">
            {% for t in trends %}<option value="{{t}}">{{t}}</option>{% endfor %}
          </select>
        </div>
      </div>

      <div class="grid-2">
        <div><label>Tenure (years)</label><input type="number" step="0.1" name="tenure_years" value="3"></div>
        <div><label>Current Salary</label><input type="number" step="100" name="current_salary" value="70000"></div>

        <div><label>Attendance %</label><input type="number" step="0.1" name="attendance_pct" value="92"></div>
        <div><label>Avg Login Delay (min)</label><input type="number" step="0.1" name="avg_login_delay_min" value="8"></div>

        <div><label>Tasks Assigned</label><input type="number" step="1" name="tasks_assigned" value="20"></div>
        <div><label>Tasks Completed On Time</label><input type="number" step="1" name="tasks_completed_on_time" value="16"></div>

        <div><label>Task Completion Rate (0-1)</label><input type="number" step="0.01" min="0" max="1" name="task_completion_rate" value="0.8"></div>
        <div><label>Quality Score (0-100)</label><input type="number" step="0.1" name="quality_score" value="75"></div>

        <div><label>Manager Rating (1-5)</label><input type="number" step="0.1" min="1" max="5" name="manager_rating" value="3.5"></div>
        <div><label>Peer Rating (1-5)</label><input type="number" step="0.1" min="1" max="5" name="peer_rating" value="3.5"></div>

        <div><label>Overtime Hours / Month</label><input type="number" step="0.1" name="overtime_hours_month" value="5"></div>
        <div><label>Past Leave Requests</label><input type="number" step="1" name="past_leave_requests" value="2"></div>

        <div><label>Past Leave Approval Rate (0-1)</label><input type="number" step="0.01" min="0" max="1" name="past_leave_approved_rate" value="0.7"></div>
      </div>

      <button type="submit" id="submitBtn"> Get Recommendation</button>
    </form>
  </div>

  <div class="card">
    <h2>System Recommendation</h2>
    <div id="results">
      <p id="resultsPlaceholder">Fill the form and click "Get Recommendation" to see predictions here.</p>
    </div>
    <p class="footnote">
      Note: the "Must Work Saturday" prediction can show very high confidence because
      it was trained on a clean rule (task completion rate below a fixed threshold).
      In a real deployment with human-decided historical data, expect softer, more
      realistic confidence levels.
    </p>
  </div>
</div>

<script>
const TARGET_LABELS = {
  "salary_change": " Salary Change",
  "wfh_allowed": " Work From Home Allowed",
  "must_work_saturday": " Must Work Saturday"
};

document.getElementById("predictForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "Thinking...";

  const form = new FormData(e.target);
  const payload = Object.fromEntries(form.entries());

  try {
    const res = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    renderResults(data);
  } catch (err) {
    document.getElementById("results").innerHTML =
      "<p style='color:#c0455a'>Something went wrong: " + err + "</p>";
  } finally {
    btn.disabled = false;
    btn.textContent = "Get Recommendation";
  }
});

function renderResults(data) {
  const container = document.getElementById("results");
  container.innerHTML = "";
  for (const [target, info] of Object.entries(data)) {
    const card = document.createElement("div");
    card.className = "result-card";

    const conf = info.confidence !== null && info.confidence !== undefined
      ? `<span class="conf">${(info.confidence * 100).toFixed(0)}% confidence</span>`
      : "";

    let whyHtml = "";
    if (info.top_features && info.top_features.length) {
      const items = info.top_features.map(f =>
        `<li>${f.feature}: ${typeof f.value === "number" ? f.value.toFixed(2) : f.value}</li>`
      ).join("");
      whyHtml = `<div class="why">Top factors the model weighs most for this decision:<ul>${items}</ul></div>`;
    }

    card.innerHTML = `
      <h3>${TARGET_LABELS[target] || target}</h3>
      <span class="badge">${info.prediction}</span> ${conf}
      ${whyHtml}
    `;
    container.appendChild(card);
  }
}
</script>

</body>
</html>
"""

if __name__ == "__main__":
    load_models()
    print("\nLoaded models for:", list(_loaded.keys()))
    print("Open http://127.0.0.1:5000 in your browser.\n")
    app.run(debug=True)