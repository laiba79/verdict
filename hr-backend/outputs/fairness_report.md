# Fairness Audit Report

Audited against 'department' because the dataset has no gender/age/ethnicity field. Methodology (demographic parity difference + four-fifths disparate impact rule) is identical for any protected attribute.

## salary_change

- **salary_change = decrease**: DPD = 0.0975, DIR = 0.3662 -- FLAGGED
- **salary_change = increase**: DPD = 0.1017, DIR = 0.7877 -- FLAGGED
- **salary_change = no_change**: DPD = 0.1011, DIR = 0.8013 -- OK

## wfh_allowed

- DPD = 0.1189, DIR = 0.7524 -- FLAGGED

  Selection rates by department:
  - Engineering: 46.3%
  - Finance: 41.0%
  - HR: 38.1%
  - Marketing: 42.9%
  - Sales: 48.0%
  - Support: 36.1%

## must_work_saturday

- DPD = 0.1219, DIR = 0.7668 -- FLAGGED

  Selection rates by department:
  - Engineering: 40.1%
  - Finance: 46.9%
  - HR: 52.3%
  - Marketing: 46.8%
  - Sales: 45.9%
  - Support: 40.2%
