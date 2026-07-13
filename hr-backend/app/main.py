"""
App entrypoint. Wires together:
- DB table creation (on startup, if tables don't exist yet)
- ML model + SHAP explainer loading (once, at startup)
- A default admin account (created only if no users exist yet)
- CORS for the frontend
- All routers: auth, employees, predictions, meta

Run with:
    uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine, SessionLocal
from app.models.user import User, UserRole
from app.auth.security import hash_password
from app.ml.loader import registry

from app.auth.router import router as auth_router
from app.routers.employees import router as employees_router
from app.routers.predictions import router as predictions_router
from app.routers.models_info import router as meta_router
from app.routers.chatbot import router as chatbot_router
from app.routers.recruitment import router as recruitment_router

settings = get_settings()


def seed_first_admin():
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            admin = User(
                email=settings.FIRST_ADMIN_EMAIL,
                full_name="Default Admin",
                hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD),
                role=UserRole.ADMIN,
            )
            db.add(admin)
            db.commit()
            print(f"[startup] Created default admin: {settings.FIRST_ADMIN_EMAIL}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    Base.metadata.create_all(bind=engine)
    seed_first_admin()
    registry.load()
    print(f"[startup] Loaded models for: {registry.available_targets()}")
    yield
    # --- shutdown (nothing to clean up currently) ---


app = FastAPI(
    title="HR Decision System API",
    description="Predicts salary changes, WFH eligibility, and mandatory "
                 "Saturday work assignments from employee performance data.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    # Scoped to what the SPA actually needs, rather than "*", now that
    # allow_credentials=True is on (browsers reject "*" with credentials
    # anyway, but being explicit here avoids relying on that fallback).
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(employees_router)
app.include_router(predictions_router)
app.include_router(meta_router)
app.include_router(chatbot_router)
app.include_router(recruitment_router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "models_ready": registry.is_ready()}
