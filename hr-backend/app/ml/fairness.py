"""
Group fairness auditing for the HR decision models.

The dataset has no gender/age/ethnicity column (see data/hr_employee_
performance_dataset.csv), so we can't audit fairness against the
"classic" protected attributes an HR system would care about most in a
real deployment. Rather than fake a demographic column, this module
audits parity across `department` instead -- it's the only categorical
group attribute the data actually has, and the same math applies
verbatim once a real protected attribute is available. That's a
deliberate, disclosed simplification, not an oversight: it's called out
explicitly in every report this module generates.

Two standard group-fairness metrics, computed per department for each
binary decision (wfh_allowed, must_work_saturday) and per predicted class
for the multiclass one (salary_change):

- Demographic Parity Difference (DPD):
    max_group(selection_rate) - min_group(selection_rate)
  How much the positive-outcome rate varies across groups. 0 = identical
  rates across every group. There's no universal legal threshold, but
  0.10-0.20 is a commonly used rule-of-thumb flag for further review.

- Disparate Impact Ratio (DIR):
    min_group(selection_rate) / max_group(selection_rate)
  The "4/5ths rule" used by the US EEOC as an adverse-impact screen: a
  ratio below 0.8 conventionally flags a group for closer review.

These are equivalent to what fairlearn's MetricFrame computes; they're
implemented directly here (plain pandas/numpy) to keep the dependency
footprint small and the math fully transparent for a viva/interview --
worth mentioning that fairlearn is a drop-in swap if the project grows.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

DPD_FLAG_THRESHOLD = 0.20
DIR_FLAG_THRESHOLD = 0.80  # EEOC "four-fifths rule"


def _group_selection_rates(df: pd.DataFrame, group_col: str, outcome_col: str) -> pd.Series:
    """Positive-outcome rate (mean of a 0/1 column) per group, groups with
    <10 rows dropped since a rate from a handful of rows is too noisy to
    make any fairness claim about."""
    counts = df.groupby(group_col)[outcome_col].count()
    valid_groups = counts[counts >= 10].index
    return df[df[group_col].isin(valid_groups)].groupby(group_col)[outcome_col].mean()


def binary_fairness_report(df: pd.DataFrame, group_col: str, outcome_col: str) -> dict:
    """Fairness audit for a single binary outcome column (already 0/1),
    e.g. predicted wfh_allowed or must_work_saturday."""
    rates = _group_selection_rates(df, group_col, outcome_col)
    if rates.empty:
        return {"outcome": outcome_col, "group_col": group_col, "error": "no group had enough rows"}

    dpd = float(rates.max() - rates.min())
    dir_ratio = float(rates.min() / rates.max()) if rates.max() > 0 else 1.0

    return {
        "outcome": outcome_col,
        "group_col": group_col,
        "selection_rates": {k: round(float(v), 4) for k, v in rates.items()},
        "demographic_parity_difference": round(dpd, 4),
        "disparate_impact_ratio": round(dir_ratio, 4),
        "flagged": bool(dpd > DPD_FLAG_THRESHOLD or dir_ratio < DIR_FLAG_THRESHOLD),
        "thresholds": {"dpd_flag_above": DPD_FLAG_THRESHOLD, "dir_flag_below": DIR_FLAG_THRESHOLD},
    }


def multiclass_fairness_report(df: pd.DataFrame, group_col: str, outcome_col: str, classes: list[str]) -> dict:
    """Runs the binary audit once per class, one-vs-rest, for a
    multiclass outcome like salary_change (increase / no_change /
    decrease). Reported per class so e.g. 'who gets flagged for a salary
    decrease at a disproportionate rate' isn't averaged away."""
    per_class = {}
    any_flagged = False
    for cls in classes:
        binary_col = f"__{outcome_col}_is_{cls}"
        tmp = df.copy()
        tmp[binary_col] = (tmp[outcome_col] == cls).astype(int)
        report = binary_fairness_report(tmp, group_col, binary_col)
        report["outcome"] = f"{outcome_col} = {cls}"
        per_class[cls] = report
        any_flagged = any_flagged or report.get("flagged", False)

    return {
        "outcome": outcome_col,
        "group_col": group_col,
        "per_class": per_class,
        "any_class_flagged": any_flagged,
    }


def build_fairness_audit(
    df: pd.DataFrame,
    predictions: dict[str, np.ndarray | pd.Series],
    group_col: str = "department",
) -> dict:
    """
    Top-level entry point used by scripts/train_models.py.

    df:          the feature dataframe (must include `group_col`)
    predictions: {"wfh_allowed": array, "must_work_saturday": array,
                  "salary_change": array-of-label-strings}
                 -- model PREDICTIONS on the test set, not the true labels.
                 We audit what the model actually decides, since that's
                 what would ship to production and affect real people.
    """
    audit = {
        "group_col": group_col,
        "note": (
            "Audited against 'department' because the dataset has no "
            "gender/age/ethnicity field. The methodology (demographic "
            "parity difference + disparate impact / four-fifths rule) is "
            "identical for any protected attribute -- swap in a real one "
            "if/when the dataset grows to include it."
        ),
        "reports": {},
    }

    work = df[[group_col]].copy()

    if "wfh_allowed" in predictions:
        work["wfh_allowed"] = np.asarray(predictions["wfh_allowed"]).astype(int)
        audit["reports"]["wfh_allowed"] = binary_fairness_report(work, group_col, "wfh_allowed")

    if "must_work_saturday" in predictions:
        work["must_work_saturday"] = np.asarray(predictions["must_work_saturday"]).astype(int)
        audit["reports"]["must_work_saturday"] = binary_fairness_report(work, group_col, "must_work_saturday")

    if "salary_change" in predictions:
        work["salary_change"] = np.asarray(predictions["salary_change"])
        classes = sorted(pd.unique(work["salary_change"]).tolist())
        audit["reports"]["salary_change"] = multiclass_fairness_report(work, group_col, "salary_change", classes)

    return audit
