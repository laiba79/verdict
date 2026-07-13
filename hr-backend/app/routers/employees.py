from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.employee import Employee
from app.models.user import User, UserRole
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeOut
from app.auth.dependencies import get_current_user, require_roles
from app.auth.scoping import scope_employees_query, can_access_employee

router = APIRouter(prefix="/employees", tags=["employees"])


def _validate_manager_assignment(db: Session, managed_by_user_id: int | None):
    """If an employee is being assigned to a manager, make sure that id
    actually points to a real, active MANAGER account -- otherwise a typo'd
    id would silently create an employee nobody can see (not even Admin/HR
    would think to look for it under a manager's team, since the id
    wouldn't resolve to anyone)."""
    if managed_by_user_id is None:
        return
    manager = db.get(User, managed_by_user_id)
    if manager is None or manager.role != UserRole.MANAGER:
        raise HTTPException(
            status_code=400,
            detail="managed_by_user_id must reference an existing user with role 'manager'.",
        )


@router.get("", response_model=list[EmployeeOut])
def list_employees(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Managers only ever see their own team; Admin/HR see everyone. Scoping
    # happens in the query itself, not by filtering results afterwards, so
    # `limit`/`skip` paginate correctly within what the user is allowed to see.
    query = scope_employees_query(db.query(Employee), current_user)
    return query.order_by(Employee.id.desc()).offset(skip).limit(limit).all()


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
    if not can_access_employee(employee, current_user):
        # 404 instead of 403 here on purpose -- a manager probing random ids
        # shouldn't be able to tell "doesn't exist" apart from "exists but
        # isn't yours", which would otherwise leak which ids are valid.
        raise HTTPException(status_code=404, detail="Employee not found.")
    return employee


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    # Only HR/Admin can create employee records; managers are read + predict only.
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.HR)),
):
    _validate_manager_assignment(db, payload.managed_by_user_id)
    employee = Employee(**payload.model_dump())
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.put("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.HR)),
):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
    _validate_manager_assignment(db, payload.managed_by_user_id)
    for field, value in payload.model_dump().items():
        setattr(employee, field, value)
    db.commit()
    db.refresh(employee)
    return employee


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.HR)),
):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
    db.delete(employee)
    db.commit()
