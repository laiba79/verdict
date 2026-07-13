from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class Employee(Base):
    """A stored employee record. Storing these means you don't have to
    re-type every field each time you want a prediction -- you save an
    employee once and re-run predictions against them as their monthly
    stats change.

    managed_by_user_id links an employee to the User (role=MANAGER) who
    owns them. This is what lets manager-scoped access work: a manager
    only sees/predicts for employees where this points back to them.
    Nullable because Admin/HR can create "unassigned" employees, or the
    dataset may have employees not yet assigned to a specific manager."""

    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    performance_trend = Column(String, nullable=False)

    managed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    tenure_years = Column(Float, nullable=False)
    current_salary = Column(Float, nullable=False)
    attendance_pct = Column(Float, nullable=False)
    avg_login_delay_min = Column(Float, nullable=False)
    tasks_assigned = Column(Float, nullable=False)
    tasks_completed_on_time = Column(Float, nullable=False)
    task_completion_rate = Column(Float, nullable=False)
    quality_score = Column(Float, nullable=False)
    manager_rating = Column(Float, nullable=False)
    peer_rating = Column(Float, nullable=False)
    overtime_hours_month = Column(Float, nullable=False)
    past_leave_requests = Column(Float, nullable=False)
    past_leave_approved_rate = Column(Float, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    predictions = relationship(
        "PredictionRecord", back_populates="employee", cascade="all, delete-orphan"
    )
    manager = relationship("User", foreign_keys=[managed_by_user_id])
