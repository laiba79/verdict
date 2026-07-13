from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

DEPARTMENTS = ["Engineering", "Sales", "Marketing", "HR", "Finance", "Support"]
TRENDS = ["improving", "stable", "declining"]


class EmployeeBase(BaseModel):
    full_name: str
    department: str
    performance_trend: str

    tenure_years: float = Field(ge=0)
    current_salary: float = Field(ge=0)
    attendance_pct: float = Field(ge=0, le=100)
    avg_login_delay_min: float = Field(ge=0)
    tasks_assigned: float = Field(ge=0)
    tasks_completed_on_time: float = Field(ge=0)
    task_completion_rate: float = Field(ge=0, le=1)
    quality_score: float = Field(ge=0, le=100)
    manager_rating: float = Field(ge=1, le=5)
    peer_rating: float = Field(ge=1, le=5)
    overtime_hours_month: float = Field(ge=0)
    past_leave_requests: float = Field(ge=0)
    past_leave_approved_rate: float = Field(ge=0, le=1)


class EmployeeCreate(EmployeeBase):
    # Optional: Admin/HR can assign an employee to a manager at creation
    # time. Left unset, the employee is "unassigned" until an admin sets it
    # via PUT, or (if the creator themselves is a manager) it's auto-filled
    # to their own id -- see the router.
    managed_by_user_id: int | None = None


class EmployeeUpdate(EmployeeBase):
    managed_by_user_id: int | None = None


class EmployeeOut(EmployeeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    managed_by_user_id: int | None = None
    created_at: datetime
    updated_at: datetime
