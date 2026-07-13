import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, Enum, Boolean

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"      # full access: manage users, employees, models
    HR = "hr"             # can run predictions, manage employees, view history
    MANAGER = "manager"   # can run predictions and view results for their team, read-only elsewhere


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.MANAGER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
