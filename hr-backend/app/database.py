"""
SQLAlchemy engine + session setup.

Uses SQLite by default (zero setup, one file on disk) but since we go
through SQLAlchemy, switching to Postgres/MySQL later is just a
DATABASE_URL change in `.env` -- no code changes needed.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session and always closes it,
    even if the request raises an exception."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
