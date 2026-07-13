"""
Step 1: Exploratory Data Analysis (EDA)
-----------------------------------------
Understand the data before building any models:
- Basic stats & missing values
- Class balance for each target
- Correlations between features and targets
- A few key visualizations
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_csv("../data/hr_employee_performance_dataset.csv")

print("=" * 60)
print("BASIC INFO")
print("=" * 60)
print(f"Shape: {df.shape}")
print(f"\nMissing values:\n{df.isnull().sum().sum()} total missing cells")
print(f"\nColumn dtypes:\n{df.dtypes}")

print("\n" + "=" * 60)
print("NUMERIC FEATURE SUMMARY")
print("=" * 60)
print(df.describe().round(2).T)

print("\n" + "=" * 60)
print("TARGET DISTRIBUTIONS")
print("=" * 60)
print("\nSalary change:\n", df["salary_change"].value_counts())
print("\nWFH allowed:\n", df["wfh_allowed"].value_counts())
print("\nMust work Saturday:\n", df["must_work_saturday"].value_counts())

# ---------------------------------------------------------
# Correlation heatmap (numeric features only)
# ---------------------------------------------------------
numeric_cols = df.select_dtypes(include=[np.number]).columns.drop("employee_id")
plt.figure(figsize=(12, 9))
sns.heatmap(df[numeric_cols].corr(), annot=True, fmt=".2f", cmap="coolwarm", center=0)
plt.title("Correlation Heatmap - Numeric Features")
plt.tight_layout()
plt.savefig("../outputs/plots/eda_correlation_heatmap.png", dpi=120)
plt.close()

# ---------------------------------------------------------
# Performance score distribution by each target
# ---------------------------------------------------------
fig, axes = plt.subplots(1, 3, figsize=(18, 5))

sns.boxplot(data=df, x="salary_change", y="performance_score",
            order=["decrease", "no_change", "increase"], ax=axes[0])
axes[0].set_title("Performance Score by Salary Decision")

sns.boxplot(data=df, x="wfh_allowed", y="performance_score", ax=axes[1])
axes[1].set_title("Performance Score by WFH Decision")
axes[1].set_xticklabels(["Not Allowed", "Allowed"])

sns.boxplot(data=df, x="must_work_saturday", y="performance_score", ax=axes[2])
axes[2].set_title("Performance Score by Saturday Work Assignment")
axes[2].set_xticklabels(["Not Required", "Must Work"])

plt.tight_layout()
plt.savefig("../outputs/plots/eda_performance_by_target.png", dpi=120)
plt.close()

# ---------------------------------------------------------
# Feature importance proxy: correlation of each numeric feature with performance_score
# ---------------------------------------------------------
print("\n" + "=" * 60)
print("TOP FEATURES CORRELATED WITH PERFORMANCE SCORE")
print("=" * 60)
corr_with_perf = df[numeric_cols].corr()["performance_score"].drop("performance_score")
print(corr_with_perf.sort_values(ascending=False).round(3))

print("\nSaved plots: eda_correlation_heatmap.png, eda_performance_by_target.png")
