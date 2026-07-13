import type { EmployeeBase } from '../types';

export const DEPARTMENTS = ["Engineering", "Sales", "Marketing", "HR", "Finance", "Support"];
export const TRENDS: EmployeeBase['performance_trend'][] = ["improving", "stable", "declining"];

export const NUMERIC_FIELDS: { key: keyof EmployeeBase; label: string; step?: number; min?: number; max?: number }[] = [
  { key: 'tenure_years', label: 'Tenure (years)', step: 0.5, min: 0 },
  { key: 'current_salary', label: 'Current salary', step: 1000, min: 0 },
  { key: 'attendance_pct', label: 'Attendance %', step: 1, min: 0, max: 100 },
  { key: 'avg_login_delay_min', label: 'Avg. login delay (min)', step: 1, min: 0 },
  { key: 'tasks_assigned', label: 'Tasks assigned', step: 1, min: 0 },
  { key: 'tasks_completed_on_time', label: 'Tasks completed on time', step: 1, min: 0 },
  { key: 'task_completion_rate', label: 'Task completion rate (0–1)', step: 0.05, min: 0, max: 1 },
  { key: 'quality_score', label: 'Quality score (0–100)', step: 1, min: 0, max: 100 },
  { key: 'manager_rating', label: 'Manager rating (1–5)', step: 0.5, min: 1, max: 5 },
  { key: 'peer_rating', label: 'Peer rating (1–5)', step: 0.5, min: 1, max: 5 },
  { key: 'overtime_hours_month', label: 'Overtime hours / month', step: 1, min: 0 },
  { key: 'past_leave_requests', label: 'Past leave requests', step: 1, min: 0 },
  { key: 'past_leave_approved_rate', label: 'Past leave approved rate (0–1)', step: 0.05, min: 0, max: 1 },
];

export const EMPTY_EMPLOYEE: EmployeeBase = {
  full_name: "",
  department: "Engineering",
  performance_trend: "stable",
  managed_by_user_id: null,
  tenure_years: 1,
  current_salary: 60000,
  attendance_pct: 95,
  avg_login_delay_min: 3,
  tasks_assigned: 20,
  tasks_completed_on_time: 18,
  task_completion_rate: 0.9,
  quality_score: 85,
  manager_rating: 4,
  peer_rating: 4,
  overtime_hours_month: 4,
  past_leave_requests: 1,
  past_leave_approved_rate: 1,
};