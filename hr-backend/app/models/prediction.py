import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship

from app.database import Base


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# Targets where the model's prediction actually changes something about the
# employee record once approved (as opposed to just being informational).
ACTIONABLE_TARGETS = {"salary_change"}


class PredictionRecord(Base):
    """Every prediction the system makes is logged here: which employee,
    which target (salary_change / wfh_allowed / must_work_saturday),
    what the model said, how confident it was, and who ran it.
    This is what powers the /predictions/history endpoint and lets you
    audit HR-affecting decisions later.

    Predictions that can actually change something about an employee (right
    now: salary_change) don't take effect immediately -- they sit in
    'pending' status until an HR/Admin user approves or rejects them via
    /predictions/{id}/approve or /reject. Non-actionable targets (wfh_allowed,
    must_work_saturday) are informational only and are auto-approved since
    there's nothing for them to apply to an employee record."""

    __tablename__ = "prediction_records"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    target = Column(String, nullable=False)          # salary_change / wfh_allowed / must_work_saturday
    prediction = Column(String, nullable=False)       # e.g. "increase", "Yes", "No"
    confidence = Column(Float, nullable=True)
    top_features = Column(JSON, nullable=True)         # list of {feature, value, impact}

    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING, nullable=False)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(String, nullable=True)
    applied = Column(String, default="no", nullable=False)  # "yes" once an approval has been applied to the employee

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    employee = relationship("Employee", back_populates="predictions", foreign_keys=[employee_id])
