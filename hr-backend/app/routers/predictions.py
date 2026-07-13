from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.employee import Employee
from app.models.prediction import PredictionRecord, ApprovalStatus, ACTIONABLE_TARGETS
from app.models.user import User, UserRole
from app.schemas.prediction import (
    PredictFromValuesRequest, PredictResponse, TargetResult,
    BatchPredictRequest, BatchPredictResponse, PredictionHistoryOut,
    ReviewRequest, AuditLogOut,
)
from app.auth.dependencies import get_current_user, require_roles
from app.auth.scoping import can_access_employee, scope_employees_query
from app.ml.loader import registry
from app.ml.predictor import predict_all

router = APIRouter(prefix="/predictions", tags=["predictions"])
settings = get_settings()


def _ensure_models_ready():
    if not registry.is_ready():
        raise HTTPException(
            status_code=503,
            detail="Models are not loaded yet. Train models first (see scripts/train_models.py).",
        )


def _log_and_build_response(db: Session, employee_id: int | None, results: dict,
                             current_user: User) -> PredictResponse:
    typed_results = {}
    for target, info in results.items():
        typed_results[target] = TargetResult(**info)

        if employee_id is not None:
            # Non-actionable targets (wfh_allowed, must_work_saturday) don't
            # change anything on the employee record, so there's nothing to
            # gate behind approval -- auto-approve them. salary_change is the
            # one target that actually moves a number, so it starts pending
            # and needs a human to sign off via /approve or /reject.
            is_actionable = target in ACTIONABLE_TARGETS
            status = ApprovalStatus.PENDING if is_actionable else ApprovalStatus.APPROVED

            db.add(PredictionRecord(
                employee_id=employee_id,
                requested_by_user_id=current_user.id,
                target=target,
                prediction=info["prediction"],
                confidence=info["confidence"],
                top_features=info["top_features"],
                status=status,
            ))
    if employee_id is not None:
        db.commit()

    return PredictResponse(employee_id=employee_id, results=typed_results)


@router.post("/employee/{employee_id}", response_model=PredictResponse)
def predict_for_saved_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run all 3 models against an already-saved employee, and log the
    predictions to that employee's history."""
    _ensure_models_ready()

    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
    if not can_access_employee(employee, current_user):
        raise HTTPException(status_code=404, detail="Employee not found.")

    data = {
        "department": employee.department,
        "performance_trend": employee.performance_trend,
        "tenure_years": employee.tenure_years,
        "current_salary": employee.current_salary,
        "attendance_pct": employee.attendance_pct,
        "avg_login_delay_min": employee.avg_login_delay_min,
        "tasks_assigned": employee.tasks_assigned,
        "tasks_completed_on_time": employee.tasks_completed_on_time,
        "task_completion_rate": employee.task_completion_rate,
        "quality_score": employee.quality_score,
        "manager_rating": employee.manager_rating,
        "peer_rating": employee.peer_rating,
        "overtime_hours_month": employee.overtime_hours_month,
        "past_leave_requests": employee.past_leave_requests,
        "past_leave_approved_rate": employee.past_leave_approved_rate,
    }

    results = predict_all(data)
    return _log_and_build_response(db, employee_id, results, current_user)


def _save_employee_scoped(db: Session, data: dict, current_user: User) -> Employee:
    """Shared save-on-the-fly logic for /quick and /batch (save_employee=true).

    Admin/HR may assign the new employee to any manager via
    managed_by_user_id (or leave it unassigned). A MANAGER using this
    shortcut can only ever create employees under their own management --
    otherwise they could hand themselves visibility into anyone's team
    just by ticking save_employee on a request with someone else's id
    (or no id, leaving it unscoped and world-visible-by-omission)."""
    if current_user.role == UserRole.MANAGER:
        data["managed_by_user_id"] = current_user.id
    elif data.get("managed_by_user_id") is not None:
        # Admin/HR may assign to any manager, but the id has to actually
        # point at a manager account -- otherwise a typo'd or made-up id
        # would silently create an employee no one can see in the "my
        # team" view, or worse, attach them to a non-manager account.
        assignee = db.get(User, data["managed_by_user_id"])
        if assignee is None or assignee.role != UserRole.MANAGER:
            raise HTTPException(
                status_code=400,
                detail="managed_by_user_id must reference an existing manager account.",
            )

    employee = Employee(**data)
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.post("/quick", response_model=PredictResponse)
def predict_from_values(
    payload: PredictFromValuesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run all 3 models against raw values without requiring a saved
    employee first. Optionally saves the employee (save_employee=true)
    so the prediction gets logged to history too."""
    _ensure_models_ready()

    data = payload.model_dump(exclude={"save_employee"})
    employee_id = None

    if payload.save_employee:
        employee = _save_employee_scoped(db, data, current_user)
        employee_id = employee.id

    results = predict_all(data)
    return _log_and_build_response(db, employee_id, results, current_user)


@router.post("/batch", response_model=BatchPredictResponse)
def predict_batch(
    payload: BatchPredictRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run predictions for a list of employees in one call -- e.g. an
    entire department's monthly review in a single request."""
    _ensure_models_ready()

    responses = []
    for item in payload.employees:
        data = item.model_dump(exclude={"save_employee"})
        employee_id = None
        if item.save_employee:
            employee = _save_employee_scoped(db, data, current_user)
            employee_id = employee.id

        results = predict_all(data)
        responses.append(_log_and_build_response(db, employee_id, results, current_user))

    return BatchPredictResponse(results=responses)


@router.get("/history/{employee_id}", response_model=list[PredictionHistoryOut])
def get_prediction_history(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
    if not can_access_employee(employee, current_user):
        raise HTTPException(status_code=404, detail="Employee not found.")

    return (
        db.query(PredictionRecord)
        .filter(PredictionRecord.employee_id == employee_id)
        .order_by(PredictionRecord.created_at.desc())
        .all()
    )


@router.get("/pending", response_model=list[PredictionHistoryOut])
def list_pending_predictions(
    db: Session = Depends(get_db),
    # Read-only -- a manager can see what's pending for their own team,
    # but only HR/Admin can actually approve/reject (see below).
    current_user: User = Depends(get_current_user),
):
    """All predictions still awaiting a human decision -- the queue that
    powers an 'approvals' dashboard. Managers only see pending items for
    employees on their own team; HR/Admin see everything."""
    query = (
        db.query(PredictionRecord)
        .join(Employee, PredictionRecord.employee_id == Employee.id)
        .filter(PredictionRecord.status == ApprovalStatus.PENDING)
    )
    query = scope_employees_query(query, current_user)
    return query.order_by(PredictionRecord.created_at.asc()).all()


@router.get("/audit", response_model=list[AuditLogOut])
def get_audit_log(
    db: Session = Depends(get_db),
    # Full decision history (every status, not just pending) is the actual
    # audit trail -- reserved for HR/Admin, same as approve/reject, since a
    # manager reviewing their own team's *pending* queue is a different
    # concern from someone auditing every salary decision ever made.
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.HR)),
):
    """Every prediction ever logged, across all employees and all statuses --
    the system-wide decision audit trail. Unlike /pending, this is not scoped
    to a manager's own team, since only HR/Admin can reach this endpoint at
    all (require_roles already enforces that)."""
    records = (
        db.query(PredictionRecord)
        .order_by(PredictionRecord.created_at.desc())
        .limit(500)
        .all()
    )

    employee_ids = {r.employee_id for r in records}
    user_ids = {r.requested_by_user_id for r in records if r.requested_by_user_id} | \
               {r.reviewed_by_user_id for r in records if r.reviewed_by_user_id}

    employees = {e.id: e for e in db.query(Employee).filter(Employee.id.in_(employee_ids)).all()} if employee_ids else {}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    def user_label(user_id: int | None) -> str | None:
        if user_id is None:
            return None
        u = users.get(user_id)
        return (u.full_name or u.email) if u else None

    out = []
    for r in records:
        employee = employees.get(r.employee_id)
        out.append(AuditLogOut(
            id=r.id,
            employee_id=r.employee_id,
            target=r.target,
            prediction=r.prediction,
            confidence=r.confidence,
            top_features=r.top_features,
            status=r.status.value if hasattr(r.status, "value") else r.status,
            reviewed_by_user_id=r.reviewed_by_user_id,
            reviewed_at=r.reviewed_at,
            review_note=r.review_note,
            created_at=r.created_at,
            employee_name=employee.full_name if employee else f"Employee #{r.employee_id}",
            requested_by_name=user_label(r.requested_by_user_id),
            reviewed_by_name=user_label(r.reviewed_by_user_id),
        ))
    return out


def _apply_approved_prediction(db: Session, record: PredictionRecord):
    """Once a salary_change prediction is approved, actually move the
    number on the employee record. Kept as its own function since more
    actionable targets may need their own 'what does approval DO' logic
    later (e.g. wfh_allowed flipping a flag on the employee)."""
    if record.target != "salary_change" or record.applied == "yes":
        return

    employee = db.get(Employee, record.employee_id)
    if employee is None:
        return

    if record.prediction == "increase":
        employee.current_salary = round(employee.current_salary * (1 + settings.SALARY_INCREASE_PCT), 2)
    elif record.prediction == "decrease":
        employee.current_salary = round(employee.current_salary * (1 - settings.SALARY_DECREASE_PCT), 2)
    # "no_change" -> nothing to apply, but still marked applied so it's not
    # re-processed.

    record.applied = "yes"


@router.post("/{prediction_id}/approve", response_model=PredictionHistoryOut)
def approve_prediction(
    prediction_id: int,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
    # Salary decisions are HR-affecting, so only HR/Admin can approve --
    # a manager can request/see a prediction but not sign off on it.
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.HR)),
):
    record = db.get(PredictionRecord, prediction_id)
    if not record:
        raise HTTPException(status_code=404, detail="Prediction not found.")
    if record.status != ApprovalStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Prediction is already '{record.status.value}' and cannot be re-approved.",
        )

    record.status = ApprovalStatus.APPROVED
    record.reviewed_by_user_id = current_user.id
    record.reviewed_at = datetime.now(timezone.utc)
    record.review_note = payload.note

    _apply_approved_prediction(db, record)

    db.commit()
    db.refresh(record)
    return record


@router.post("/{prediction_id}/reject", response_model=PredictionHistoryOut)
def reject_prediction(
    prediction_id: int,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.HR)),
):
    record = db.get(PredictionRecord, prediction_id)
    if not record:
        raise HTTPException(status_code=404, detail="Prediction not found.")
    if record.status != ApprovalStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Prediction is already '{record.status.value}' and cannot be re-rejected.",
        )

    record.status = ApprovalStatus.REJECTED
    record.reviewed_by_user_id = current_user.id
    record.reviewed_at = datetime.now(timezone.utc)
    record.review_note = payload.note
    # applied stays "no" -- a rejected prediction never touches the employee record.

    db.commit()
    db.refresh(record)
    return record