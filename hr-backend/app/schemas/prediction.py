from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.schemas.employee import EmployeeBase


class TopFeature(BaseModel):
    feature: str
    value: float | str
    impact: float | None = None   # signed SHAP contribution, when available


class TargetResult(BaseModel):
    prediction: str
    confidence: float | None = None
    top_features: list[TopFeature] = []


class PredictResponse(BaseModel):
    employee_id: int | None = None
    results: dict[str, TargetResult]


class PredictFromValuesRequest(EmployeeBase):
    """Predict without saving an employee record first -- just send the
    raw values (used by the 'quick prediction' form on the frontend)."""
    save_employee: bool = False


class BatchPredictRequest(BaseModel):
    employees: list[PredictFromValuesRequest]


class BatchPredictResponse(BaseModel):
    results: list[PredictResponse]


class PredictionHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    target: str
    prediction: str
    confidence: float | None
    top_features: list[dict] | None
    status: str
    reviewed_by_user_id: int | None
    reviewed_at: datetime | None
    review_note: str | None
    created_at: datetime


class AuditLogOut(PredictionHistoryOut):
    """Same shape as PredictionHistoryOut, plus the human-readable names an
    audit log actually needs to display -- no one reading a system-wide log
    wants to cross-reference raw employee_id / reviewed_by_user_id by hand."""

    employee_name: str
    requested_by_name: str | None = None
    reviewed_by_name: str | None = None


class ReviewRequest(BaseModel):
    """Body for approve/reject. Note is optional -- e.g. why a raise was
    rejected, or a condition attached to an approval."""
    note: str | None = None