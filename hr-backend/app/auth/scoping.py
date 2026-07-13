"""
Data-access scoping rules -- separate from `dependencies.py` (which handles
*authentication* and *role* checks) because this is a different concern:
given an already-authenticated user, which ROWS are they allowed to see?

Rule: ADMIN and HR see everything. MANAGER only sees employees where
Employee.managed_by_user_id == their own user id ("their team"). This is
enforced in the query itself (not just hidden in the UI), so a manager
can't view or predict for someone else's employee just by guessing an id
in the URL.
"""

from sqlalchemy.orm import Query

from app.models.employee import Employee
from app.models.user import User, UserRole


def scope_employees_query(query: Query, current_user: User) -> Query:
    """Given a base `db.query(Employee)` (or query joined against it),
    narrows it to what `current_user` is allowed to see."""
    if current_user.role in (UserRole.ADMIN, UserRole.HR):
        return query
    # MANAGER: only their own team.
    return query.filter(Employee.managed_by_user_id == current_user.id)


def can_access_employee(employee: Employee, current_user: User) -> bool:
    """Single-object version of the same rule, for endpoints that already
    fetched one Employee by id (e.g. GET /employees/{id}) and just need a
    yes/no instead of a query filter."""
    if current_user.role in (UserRole.ADMIN, UserRole.HR):
        return True
    return employee.managed_by_user_id == current_user.id
