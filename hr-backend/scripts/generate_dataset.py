"""
Synthetic HR Employee Performance Dataset Generator
----------------------------------------------------
Generates a realistic employee performance dataset and derives
rule-based labels for three HR decisions:
    1. salary_change   -> "increase" / "no_change" / "decrease"
    2. wfh_allowed     -> 1 / 0
    3. saturday_leave_approved -> 1 / 0

These rule-based labels act as a starting policy. Once you have
this dataset, you train ML models to approximate/generalize these
rules, then refine them with real HR/manager input.
"""

import numpy as np
import pandas as pd

np.random.seed(42)

N = 4000  # number of employee-month records

# ---------------------------------------------------------
# 1. Core employee attributes
# ---------------------------------------------------------
employee_id = np.arange(1, N + 1)
department = np.random.choice(
    ["Engineering", "Sales", "Marketing", "HR", "Finance", "Support"],
    size=N, p=[0.3, 0.2, 0.15, 0.1, 0.1, 0.15]
)
tenure_years = np.round(np.random.exponential(scale=2.5, size=N).clip(0.1, 20), 1)
current_salary = np.round(
    np.random.normal(loc=70000, scale=20000, size=N).clip(30000, 200000), -2
)

# ---------------------------------------------------------
# 2. Performance / behavior features (the "logs")
# ---------------------------------------------------------
attendance_pct = np.random.normal(92, 8, N).clip(50, 100)
avg_login_delay_min = np.random.exponential(10, N).clip(0, 120)  # lateness
tasks_assigned = np.random.poisson(20, N).clip(1, None)
tasks_completed_on_time = np.round(
    tasks_assigned * np.random.beta(6, 2, N)
).astype(int)
task_completion_rate = (tasks_completed_on_time / tasks_assigned).clip(0, 1)

quality_score = np.random.normal(75, 15, N).clip(0, 100)          # review/QA score
manager_rating = np.random.normal(3.5, 0.9, N).clip(1, 5)          # 1-5 scale
peer_rating = np.random.normal(3.5, 0.8, N).clip(1, 5)
overtime_hours_month = np.random.exponential(5, N).clip(0, 60)
past_leave_requests = np.random.poisson(2, N)
past_leave_approved_rate = np.random.beta(5, 2, N)
performance_trend = np.random.choice(
    ["improving", "stable", "declining"], size=N, p=[0.35, 0.4, 0.25]
)

# Composite performance score (0-100) used to drive rule-based labels
performance_score = (
    0.25 * task_completion_rate * 100 +
    0.25 * quality_score +
    0.20 * (manager_rating / 5 * 100) +
    0.10 * (peer_rating / 5 * 100) +
    0.10 * attendance_pct +
    0.10 * (100 - np.clip(avg_login_delay_min, 0, 60) / 60 * 100)
)
performance_score = performance_score.clip(0, 100)

# ---------------------------------------------------------
# 3. Rule-based labels (starting policy — tune with HR input)
# ---------------------------------------------------------

# --- Salary change ---
def salary_decision(row):
    if row["performance_score"] >= 75 and row["performance_trend"] != "declining":
        return "increase"
    elif row["performance_score"] < 65 or (
        row["performance_trend"] == "declining" and row["performance_score"] < 72
    ):
        return "decrease"
    else:
        return "no_change"

# --- WFH eligibility ---
def wfh_decision(row):
    return int(
        row["performance_score"] >= 72
        and row["task_completion_rate"] >= 0.75
        and row["attendance_pct"] >= 85
    )

# --- Mandatory Saturday work assignment ---
# This is NOT a leave-approval decision. It answers: "should the company make
# this employee come in on Saturday?" Underperformers / employees with a task
# backlog are more likely to be called in to catch up. High performers who are
# on top of their workload are NOT asked to work weekends (that's the reward).
# Safety rule: never assign Saturday work to someone already doing heavy
# overtime, regardless of performance -- avoids burning people out further.
def must_work_saturday_decision(row):
    is_behind = (
        row["task_completion_rate"] < 0.68
        or row["performance_trend"] == "declining"
    )
    already_overworked = row["overtime_hours_month"] >= 20
    return int(is_behind and not already_overworked)

df = pd.DataFrame({
    "employee_id": employee_id,
    "department": department,
    "tenure_years": tenure_years,
    "current_salary": current_salary,
    "attendance_pct": np.round(attendance_pct, 1),
    "avg_login_delay_min": np.round(avg_login_delay_min, 1),
    "tasks_assigned": tasks_assigned,
    "tasks_completed_on_time": tasks_completed_on_time,
    "task_completion_rate": np.round(task_completion_rate, 2),
    "quality_score": np.round(quality_score, 1),
    "manager_rating": np.round(manager_rating, 2),
    "peer_rating": np.round(peer_rating, 2),
    "overtime_hours_month": np.round(overtime_hours_month, 1),
    "past_leave_requests": past_leave_requests,
    "past_leave_approved_rate": np.round(past_leave_approved_rate, 2),
    "performance_trend": performance_trend,
    "performance_score": np.round(performance_score, 1),
})

df["salary_change"] = df.apply(salary_decision, axis=1)
df["wfh_allowed"] = df.apply(wfh_decision, axis=1)
df["must_work_saturday"] = df.apply(must_work_saturday_decision, axis=1)

# ---------------------------------------------------------
# 4. Save
# ---------------------------------------------------------
out_path = "../data/hr_employee_performance_dataset.csv"
df.to_csv(out_path, index=False)

print(f"Saved {len(df)} records to {out_path}")
print("\nLabel distributions:")
print(df["salary_change"].value_counts(normalize=True).round(2))
print()
print(df["wfh_allowed"].value_counts(normalize=True).round(2))
print()
print(df["must_work_saturday"].value_counts(normalize=True).round(2))
print("\nSample rows:")
print(df.head(5).to_string())
