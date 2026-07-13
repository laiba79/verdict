from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserOut, Token, UserStatusUpdate
from app.auth.security import hash_password, verify_password, create_access_token
from app.auth.dependencies import require_roles, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    # Lets the frontend restore the logged-in user on page refresh -- the
    # JWT survives in localStorage, but the User object it decodes to does
    # not, so the SPA needs a cheap way to re-fetch "who am I" on load.
    return current_user


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    # Account list is Admin-only -- HR/Manager have no reason to see or
    # manage login credentials for other staff.
    _current_admin: User = Depends(require_roles(UserRole.ADMIN)),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/managers", response_model=list[UserOut])
def list_managers(
    db: Session = Depends(get_db),
    # Unlike /auth/users (admin-only, full account list), this is scoped to
    # just active MANAGER accounts and is available to HR too -- HR is the
    # role that actually creates/edits employees and needs a picker of "who
    # can this employee be assigned to" without seeing the full user list
    # (other admins, disabled accounts, etc).
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.HR)),
):
    return (
        db.query(User)
        .filter(User.role == UserRole.MANAGER, User.is_active.is_(True))
        .order_by(User.full_name, User.email)
        .all()
    )


@router.patch("/users/{user_id}/status", response_model=UserOut)
def set_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
):
    if user_id == current_admin.id and not payload.is_active:
        # An admin locking themselves out would leave the account with no
        # way back in short of editing the database directly.
        raise HTTPException(status_code=400, detail="You can't deactivate your own account.")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserCreate,
    db: Session = Depends(get_db),
    # Only an existing admin can create new accounts. This prevents random
    # people from self-registering as "admin" against an HR system.
    _current_admin: User = Depends(require_roles(UserRole.ADMIN)),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="A user with this email already exists.")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm expects fields named "username" and "password"
    # (OAuth2 spec) -- we treat "username" as the user's email.
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled.")

    access_token = create_access_token(subject=user.email, extra_claims={"role": user.role.value})
    return Token(access_token=access_token, user=user)