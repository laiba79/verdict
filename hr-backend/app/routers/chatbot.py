"""
'Ask HR Assistant' chatbot.

Design choice: this endpoint does NOT hand the LLM raw database access or
free-form SQL. It builds a small, role-scoped summary of the requester's own
data (using the same scope_employees_query rule as everywhere else in the
app) and passes that as context in the system prompt. The model can only
talk about numbers it was explicitly given -- it can't go fetch a different
manager's team, and it can't run arbitrary queries. That keeps the RBAC
guarantees of the rest of the app intact even though a third-party LLM is
in the loop.

Beyond the basic dashboard snapshot, the context now also includes:
- A rollup of which features most often drive recent predictions (from the
  SHAP-derived top_features already stored on PredictionRecord), so the
  assistant can answer "what usually drives a salary increase here" with
  real, grounded numbers instead of a generic guess.
- A hiring pipeline snapshot (HR/Admin only) built from the recruitment
  module's MatchReport data: average match score, verdict mix, and the
  most commonly missing keywords across candidates -- so the assistant can
  answer things like "how's the pipeline for our open roles looking".

The assistant is also allowed to answer general HR knowledge questions
(performance management, interviewing, onboarding, retention, comp
philosophy, resume/JD screening tips) and app how-to questions, not just
questions about the live data snapshot -- while still being told to give
only generic, non-jurisdiction-specific guidance on anything legal.

Uses Groq (https://console.groq.com) because it has a genuinely free tier
with fast inference and no credit card requirement -- a reasonable default
for a portfolio/demo project. Swapping providers later only means changing
_call_groq(); the router/schema/frontend contract stays the same.
"""

from collections import Counter

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.scoping import scope_employees_query
from app.config import get_settings
from app.database import get_db
from app.models.employee import Employee
from app.models.prediction import ApprovalStatus, PredictionRecord
from app.models.recruitment import Candidate, JobDescription, MatchReport
from app.models.user import User

router = APIRouter(prefix="/chatbot", tags=["chatbot"])

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    # Short rolling history from the frontend so follow-up questions like
    # "and which of those is highest?" work. Capped hard below regardless
    # of what's sent, to bound tokens/cost per request.
    history: list[dict] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str


def _recent_prediction_drivers(db: Session, user: User, limit: int = 30) -> str:
    """Aggregates which features most often show up in recent SHAP
    explanations (top_features), scoped the same way as everywhere else.
    This gives the model real, grounded material to answer "why does the
    system tend to recommend X" without exposing any single employee's
    record -- it's a pattern across many predictions, not a lookup."""
    query = db.query(PredictionRecord).order_by(PredictionRecord.created_at.desc())
    if user.role.value == "manager":
        query = query.join(Employee).filter(Employee.managed_by_user_id == user.id)
    records = query.limit(limit).all()

    driver_counts: Counter = Counter()
    for r in records:
        for feat in (r.top_features or [])[:3]:
            name = feat.get("feature") if isinstance(feat, dict) else None
            if name:
                driver_counts[name] += 1

    if not driver_counts:
        return "- No prediction history yet to summarize typical drivers.\n"
    top = ", ".join(f"{name} ({count}x)" for name, count in driver_counts.most_common(5))
    return f"- Most frequent drivers behind recent predictions (from SHAP explanations): {top}\n"


def _hiring_pipeline_snapshot(db: Session, user: User) -> str:
    """HR/Admin only -- managers don't have visibility into hiring, so this
    section is simply omitted from their context rather than shown empty."""
    if user.role.value == "manager":
        return ""

    open_jds = db.query(JobDescription).count()
    total_candidates = db.query(Candidate).count()
    reports = db.query(MatchReport).order_by(MatchReport.created_at.desc()).limit(50).all()

    if not open_jds and not total_candidates:
        return "\nHiring pipeline: no job descriptions or candidates added yet via Recruitment."

    lines = [
        "\nHiring pipeline snapshot:",
        f"- Open job descriptions: {open_jds}",
        f"- Candidates uploaded: {total_candidates}",
    ]

    if reports:
        avg_score = round(sum(r.match_score for r in reports) / len(reports), 1)
        verdict_counts = Counter(r.verdict for r in reports)
        verdict_line = ", ".join(f"{v}: {c}" for v, c in verdict_counts.most_common())

        missing_counts: Counter = Counter()
        for r in reports:
            for kw in (r.missing_keywords or [])[:5]:
                missing_counts[kw] += 1
        common_gaps = ", ".join(kw for kw, _ in missing_counts.most_common(5)) or "none tracked yet"

        lines.append(f"- Average match score (last {len(reports)} reports): {avg_score}/100")
        lines.append(f"- Verdict breakdown: {verdict_line}")
        lines.append(f"- Most commonly MISSING keywords across candidates: {common_gaps}")
    else:
        lines.append("- No candidates have been analyzed yet.")

    return "\n".join(lines)


def _build_context(db: Session, user: User) -> str:
    """A short, role-scoped snapshot of the requester's own data -- this
    is the ONLY information about the org the model is given."""
    employees = scope_employees_query(db.query(Employee), user).all()
    dept_counts = Counter(e.department for e in employees)
    declining = sum(1 for e in employees if e.performance_trend == "declining")
    improving = sum(1 for e in employees if e.performance_trend == "improving")

    pending_q = db.query(PredictionRecord).filter(PredictionRecord.status == ApprovalStatus.PENDING)
    if user.role.value == "manager":
        pending_q = pending_q.join(Employee).filter(Employee.managed_by_user_id == user.id)
    pending_count = pending_q.count()

    scope_label = "their own team" if user.role.value == "manager" else "the whole company"
    dept_lines = ", ".join(f"{name}: {count}" for name, count in dept_counts.most_common()) or "none yet"

    drivers_line = _recent_prediction_drivers(db, user)
    hiring_line = _hiring_pipeline_snapshot(db, user)

    return (
        f"You are the HR Assistant inside the HR Decision System, talking to a "
        f"logged-in {user.role.value} ({user.full_name or user.email}), scoped to {scope_label}.\n\n"
        f"Current data snapshot (this is ALL the org data you have access to -- never invent numbers "
        f"beyond this):\n"
        f"- Total employees in view: {len(employees)}\n"
        f"- By department: {dept_lines}\n"
        f"- Declining performance trend: {declining}\n"
        f"- Improving performance trend: {improving}\n"
        f"- Pending prediction approvals: {pending_count}\n"
        f"{drivers_line}"
        f"{hiring_line}\n\n"
        f"You can help with THREE kinds of questions:\n"
        f"1. This org's data snapshot above (e.g. pending approvals, department mix, typical "
        f"prediction drivers, hiring pipeline stats if shown).\n"
        f"2. How to use the app -- Employees, Predictions, Approvals, and Recruitment pages "
        f"(job descriptions, candidate upload, match reports, ranking, bias checker, resume "
        f"doctor, interview question generator).\n"
        f"3. General HR knowledge and best practice: performance management, interviewing, "
        f"onboarding, retention, compensation philosophy, how to read a SHAP-style 'why' "
        f"explanation, resume/JD screening tips, inclusive job-description writing, etc. For "
        f"anything touching labor law specifically, give general, widely-known principles and "
        f"clearly say it isn't legal advice and varies by jurisdiction -- don't state a specific "
        f"law as fact.\n\n"
        f"Keep answers short (2-5 sentences unless asked for detail). If asked about a specific "
        f"employee or candidate by name, say you don't have per-record detail in this chat and "
        f"point to the relevant page (Employees / Recruitment) instead."
    )


async def _call_groq(system_prompt: str, history: list[dict], message: str, api_key: str, model: str) -> str:
    messages = [{"role": "system", "content": system_prompt}]
    for turn in history[-6:]:  # cap history to keep the request small
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and isinstance(content, str):
            messages.append({"role": role, "content": content[:1000]})
    messages.append({"role": "user", "content": message})

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": messages, "temperature": 0.3, "max_tokens": 600},
        )

    if resp.status_code != 200:
        # Don't leak provider error bodies to the client -- log server-side
        # if you add logging, but keep the client message generic.
        raise HTTPException(status_code=502, detail="The chatbot provider returned an error. Please try again.")

    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="The chatbot provider returned an unexpected response.")


@router.post("/ask", response_model=ChatResponse)
async def ask_chatbot(payload: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="The chatbot isn't configured yet. Add a free GROQ_API_KEY to .env (see .env.example).",
        )

    system_prompt = _build_context(db, current_user)
    reply = await _call_groq(system_prompt, payload.history, payload.message, settings.GROQ_API_KEY, settings.GROQ_MODEL)
    return ChatResponse(reply=reply)
