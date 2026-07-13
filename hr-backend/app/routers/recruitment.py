"""
AI Recruitment module: upload a job description, upload candidate resumes
against it, and get an LLM-generated match report (score, verdict, keyword
gap analysis, strengths/gaps, interview questions). Also standalone
utilities that don't need a stored candidate: a JD bias/inclusive-language
checker, and "Resume Doctor" self-improvement feedback.

Restricted to ADMIN/HR for now -- hiring decisions are an HR-domain
concern, same reasoning as why employees.py locks writes away from
MANAGER. Revisit if managers need read-only visibility into their own
team's openings later.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.config import get_settings
from app.database import get_db
from app.models.recruitment import JobDescription, Candidate, MatchReport
from app.models.user import User, UserRole
from app.schemas.recruitment import (
    JobDescriptionCreate,
    JobDescriptionOut,
    CandidateOut,
    MatchReportOut,
    RankingOut,
    RankingEntry,
    BiasCheckRequest,
    BiasCheckOut,
    ResumeDoctorOut,
    PipelineSnapshotOut,
    VerdictCount,
)
from app.services.llm import call_groq_json
from app.services.embedding_matcher import semantic_similarity
from app.services.resume_parser import extract_resume_text
from app.services.recruitment_prompts import (
    match_analysis_prompt,
    interview_questions_prompt,
    bias_check_prompt,
    resume_doctor_prompt,
)

router = APIRouter(prefix="/recruitment", tags=["recruitment"])

_hr_or_admin = require_roles(UserRole.ADMIN, UserRole.HR)


def _require_groq_key():
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI features aren't configured yet. Add a free GROQ_API_KEY to .env (see .env.example).",
        )
    return settings


# ---------------------------------------------------------------- JDs ----

@router.post("/job-descriptions", response_model=JobDescriptionOut, status_code=201)
def create_job_description(
    payload: JobDescriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_hr_or_admin),
):
    jd = JobDescription(
        title=payload.title,
        department=payload.department,
        raw_text=payload.raw_text,
        created_by_user_id=current_user.id,
    )
    db.add(jd)
    db.commit()
    db.refresh(jd)
    return JobDescriptionOut(**jd.__dict__, candidate_count=0)


@router.get("/job-descriptions", response_model=list[JobDescriptionOut])
def list_job_descriptions(db: Session = Depends(get_db), current_user: User = Depends(_hr_or_admin)):
    jds = db.query(JobDescription).order_by(JobDescription.id.desc()).all()
    return [JobDescriptionOut(**jd.__dict__, candidate_count=len(jd.candidates)) for jd in jds]


@router.get("/job-descriptions/{jd_id}", response_model=JobDescriptionOut)
def get_job_description(jd_id: int, db: Session = Depends(get_db), current_user: User = Depends(_hr_or_admin)):
    jd = db.get(JobDescription, jd_id)
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found.")
    return JobDescriptionOut(**jd.__dict__, candidate_count=len(jd.candidates))


@router.delete("/job-descriptions/{jd_id}", status_code=204)
def delete_job_description(jd_id: int, db: Session = Depends(get_db), current_user: User = Depends(_hr_or_admin)):
    jd = db.get(JobDescription, jd_id)
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found.")
    db.delete(jd)
    db.commit()


# --------------------------------------------------------- Candidates ----

@router.post("/candidates", response_model=CandidateOut, status_code=201)
async def upload_candidate(
    job_description_id: int = Form(...),
    full_name: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_hr_or_admin),
):
    jd = db.get(JobDescription, job_description_id)
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found.")

    resume_text = await extract_resume_text(file)

    candidate = Candidate(
        job_description_id=job_description_id,
        full_name=full_name,
        file_name=file.filename or "resume",
        resume_text=resume_text,
        uploaded_by_user_id=current_user.id,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.get("/candidates/{candidate_id}", response_model=CandidateOut)
def get_candidate(candidate_id: int, db: Session = Depends(get_db), current_user: User = Depends(_hr_or_admin)):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    return candidate


# ------------------------------------------------------- Match Reports ----

def _report_to_out(report: MatchReport) -> MatchReportOut:
    return MatchReportOut(
        id=report.id,
        candidate_id=report.candidate_id,
        match_score=report.match_score,
        semantic_similarity=report.semantic_similarity,
        verdict=report.verdict,
        summary=report.summary,
        matched_keywords=report.matched_keywords,
        missing_keywords=report.missing_keywords,
        strengths=report.strengths,
        gaps=report.gaps,
        breakdown=report.breakdown,
        interview_questions=report.interview_questions,
        created_at=report.created_at,
    )


@router.post("/candidates/{candidate_id}/analyze", response_model=MatchReportOut)
async def analyze_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_hr_or_admin),
):
    """Runs (or re-runs) the AI match analysis for a candidate against the
    job description they were uploaded for, and stores the result."""
    settings = _require_groq_key()

    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    system, user = match_analysis_prompt(candidate.job_description.raw_text, candidate.resume_text)
    result = await call_groq_json(system, user, settings.GROQ_API_KEY, settings.GROQ_MODEL)

    # Independent, non-LLM signal: embedding-space cosine similarity
    # between the raw resume and JD text. Computed locally (no API call),
    # so a failure here shouldn't take down the whole analysis -- if it
    # ever throws (e.g. model not yet cached on a fresh machine), we still
    # want the LLM report to save successfully.
    try:
        semantic_score = semantic_similarity(candidate.resume_text, candidate.job_description.raw_text)
    except Exception:
        semantic_score = None

    try:
        report = MatchReport(
            candidate_id=candidate.id,
            match_score=float(result["match_score"]),
            semantic_similarity=semantic_score,
            verdict=str(result["verdict"]),
            summary=str(result["summary"]),
            matched_keywords=list(result["matched_keywords"]),
            missing_keywords=list(result["missing_keywords"]),
            strengths=list(result["strengths"]),
            gaps=list(result["gaps"]),
            breakdown=dict(result["breakdown"]),
            created_by_user_id=current_user.id,
        )
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=502, detail="The AI returned a report in an unexpected shape. Please try again.")

    db.add(report)
    db.commit()
    db.refresh(report)
    return _report_to_out(report)


@router.get("/candidates/{candidate_id}/reports", response_model=list[MatchReportOut])
def list_reports(candidate_id: int, db: Session = Depends(get_db), current_user: User = Depends(_hr_or_admin)):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    reports = (
        db.query(MatchReport)
        .filter(MatchReport.candidate_id == candidate_id)
        .order_by(MatchReport.id.desc())
        .all()
    )
    return [_report_to_out(r) for r in reports]


@router.post("/candidates/{candidate_id}/interview-questions", response_model=MatchReportOut)
async def generate_interview_questions(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_hr_or_admin),
):
    """Generates interview questions targeted at the gaps/missing keywords
    from the candidate's most recent match report. Requires that report to
    exist already (run /analyze first)."""
    settings = _require_groq_key()

    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    report = (
        db.query(MatchReport)
        .filter(MatchReport.candidate_id == candidate_id)
        .order_by(MatchReport.id.desc())
        .first()
    )
    if not report:
        raise HTTPException(
            status_code=400,
            detail="No match report yet for this candidate -- run /analyze first.",
        )

    system, user = interview_questions_prompt(
        candidate.job_description.raw_text, candidate.resume_text, report.gaps, report.missing_keywords
    )
    result = await call_groq_json(system, user, settings.GROQ_API_KEY, settings.GROQ_MODEL)

    try:
        questions = list(result["questions"])
    except (KeyError, TypeError):
        raise HTTPException(status_code=502, detail="The AI returned questions in an unexpected shape. Please try again.")

    report.interview_questions = questions
    db.commit()
    db.refresh(report)
    return _report_to_out(report)


# ------------------------------------------------------------ Ranking ----

@router.get("/job-descriptions/{jd_id}/ranking", response_model=RankingOut)
def rank_candidates(jd_id: int, db: Session = Depends(get_db), current_user: User = Depends(_hr_or_admin)):
    """Ranks all candidates for a job description by their most recent
    match score, highest first. Candidates with no report yet are excluded
    (they haven't been analyzed)."""
    jd = db.get(JobDescription, jd_id)
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found.")

    entries: list[RankingEntry] = []
    for candidate in jd.candidates:
        latest = (
            db.query(MatchReport)
            .filter(MatchReport.candidate_id == candidate.id)
            .order_by(MatchReport.id.desc())
            .first()
        )
        if latest:
            entries.append(
                RankingEntry(
                    candidate_id=candidate.id,
                    candidate_name=candidate.full_name,
                    file_name=candidate.file_name,
                    match_score=latest.match_score,
                    verdict=latest.verdict,
                    report_id=latest.id,
                )
            )

    entries.sort(key=lambda e: e.match_score, reverse=True)
    return RankingOut(job_description_id=jd.id, job_title=jd.title, ranking=entries)


# ------------------------------------------------------ Pipeline Snapshot ----

@router.get("/pipeline-snapshot", response_model=PipelineSnapshotOut)
def pipeline_snapshot(db: Session = Depends(get_db), current_user: User = Depends(_hr_or_admin)):
    """Aggregate hiring-pipeline stats across every job description --
    powers the dashboard widget. Same underlying numbers the HR Assistant
    chatbot already has in its context, just exposed as a normal endpoint
    so the frontend can render them without going through the LLM."""
    open_jds = db.query(JobDescription).count()
    total_candidates = db.query(Candidate).count()
    reports = db.query(MatchReport).order_by(MatchReport.created_at.desc()).limit(200).all()

    if not reports:
        return PipelineSnapshotOut(
            open_job_descriptions=open_jds,
            candidates_uploaded=total_candidates,
            reports_generated=0,
            average_match_score=None,
            verdict_breakdown=[],
            top_missing_keywords=[],
        )

    avg_score = round(sum(r.match_score for r in reports) / len(reports), 1)

    verdict_counts: dict[str, int] = {}
    for r in reports:
        verdict_counts[r.verdict] = verdict_counts.get(r.verdict, 0) + 1
    verdict_breakdown = [
        VerdictCount(verdict=v, count=c)
        for v, c in sorted(verdict_counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

    missing_counts: dict[str, int] = {}
    for r in reports:
        for kw in (r.missing_keywords or [])[:5]:
            missing_counts[kw] = missing_counts.get(kw, 0) + 1
    top_missing = [kw for kw, _ in sorted(missing_counts.items(), key=lambda kv: kv[1], reverse=True)[:6]]

    return PipelineSnapshotOut(
        open_job_descriptions=open_jds,
        candidates_uploaded=total_candidates,
        reports_generated=len(reports),
        average_match_score=avg_score,
        verdict_breakdown=verdict_breakdown,
        top_missing_keywords=top_missing,
    )


# -------------------------------------------------------- Bias Checker ----

@router.post("/bias-check", response_model=BiasCheckOut)
async def bias_check(payload: BiasCheckRequest, current_user: User = Depends(_hr_or_admin)):
    """Ad-hoc bias/inclusive-language check -- doesn't require a saved JD,
    so it can be used while still drafting one."""
    settings = _require_groq_key()
    system, user = bias_check_prompt(payload.raw_text)
    result = await call_groq_json(system, user, settings.GROQ_API_KEY, settings.GROQ_MODEL)

    try:
        return BiasCheckOut(
            overall_risk=str(result["overall_risk"]),
            summary=str(result["summary"]),
            flags=list(result["flags"]),
        )
    except (KeyError, TypeError):
        raise HTTPException(status_code=502, detail="The AI returned an unexpected response. Please try again.")


# -------------------------------------------------------- Resume Doctor ----

@router.post("/resume-doctor", response_model=ResumeDoctorOut)
async def resume_doctor(
    jd_text: str = Form(..., min_length=20, max_length=20_000),
    file: UploadFile = File(...),
    current_user: User = Depends(_hr_or_admin),
):
    """Self-improvement feedback: candidate's own resume + a target JD,
    returns actionable suggestions. Stateless -- nothing is saved, since
    this is advice, not a hiring record."""
    settings = _require_groq_key()
    resume_text = await extract_resume_text(file)

    system, user = resume_doctor_prompt(jd_text, resume_text)
    result = await call_groq_json(system, user, settings.GROQ_API_KEY, settings.GROQ_MODEL)

    try:
        return ResumeDoctorOut(
            overall_feedback=str(result["overall_feedback"]),
            missing_keywords_to_add=list(result["missing_keywords_to_add"]),
            section_suggestions=list(result["section_suggestions"]),
            rewrite_example=str(result["rewrite_example"]),
        )
    except (KeyError, TypeError):
        raise HTTPException(status_code=502, detail="The AI returned an unexpected response. Please try again.")
