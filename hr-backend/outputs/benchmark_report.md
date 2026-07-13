# Model Benchmark Report

Four model variants trained per target. **Model selection uses validation macro-F1 only**; test-set numbers below are for comparison/reporting and never influenced which model shipped.

## salary_change

| Model | Test Accuracy | Test Macro F1 | Shipped |
|---|---|---|---|
| LogisticRegression | 0.978 | 0.970 | YES |
| RandomForest | 0.858 | 0.826 |  |
| XGBoost (no weighting) | 0.912 | 0.859 |  |
| XGBoost (balanced) | 0.924 | 0.892 |  |

## wfh_allowed

| Model | Test Accuracy | Test Macro F1 | Shipped |
|---|---|---|---|
| LogisticRegression | 0.851 | 0.849 |  |
| RandomForest | 0.966 | 0.966 |  |
| XGBoost (no weighting) | 0.988 | 0.987 |  |
| XGBoost (balanced) | 0.984 | 0.983 | YES |

## must_work_saturday

| Model | Test Accuracy | Test Macro F1 | Shipped |
|---|---|---|---|
| LogisticRegression | 0.969 | 0.968 |  |
| RandomForest | 0.998 | 0.998 |  |
| XGBoost (no weighting) | 0.998 | 0.998 |  |
| XGBoost (balanced) | 0.998 | 0.998 | YES |

## Class imbalance handling (salary_change)

`salary_change = decrease` is only **10.3%** of the dataset -- the model can score well on accuracy alone while barely learning this class. Per-sample class weighting (`compute_sample_weight('balanced', ...)`) was applied to XGBoost to correct for this:

| | No weighting | Balanced |
|---|---|---|
| Macro F1 (all classes) | 0.859 | 0.892 |
| F1 on minority class ('decrease') | 0.713 | 0.800 |
