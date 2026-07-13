"""
Models for the AI Recruitment module: a recruiter/HR creates a
JobDescription, uploads one or more Candidate resumes against it, and the
system generates a MatchReport per candidate (score, verdict, keyword gap
analysis, interview questions) via the LLM. This mirrors the same shape as
the existing prediction pipeline (Employee -> PredictionRecord) so it slots
into the app's existing patterns rather than inventing new ones.
"""

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship

from app.database import Base


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    department = Column(String, nullable=True)
    raw_text = Column(Text, nullable=False)

    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    candidates = relationship(
        "Candidate", back_populates="job_description", cascade="all, delete-orphan"
    )


class Candidate(Base):
    """A resume uploaded against a specific job description. resume_text is
    the extracted plain text (from PDF/DOCX) -- the raw file itself is not
    kept on disk, only the parsed text needed for analysis."""

    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    job_description_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=False)

    full_name = Column(String, nullable=True)
    file_name = Column(String, nullable=False)
    resume_text = Column(Text, nullable=False)

    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    job_description = relationship("JobDescription", back_populates="candidates")
    reports = relationship(
        "MatchReport", back_populates="candidate", cascade="all, delete-orphan"
    )


class MatchReport(Base):
    """The AI-generated analysis of one candidate against the job
    description they were uploaded for. One candidate can be re-analyzed
    (e.g. after the JD is edited), so this is a log, not a 1:1 field on
    Candidate -- callers use the most recent one."""

    __tablename__ = "match_reports"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)

    match_score = Column(Float, nullable=False)     # 0-100 (LLM-reasoned)
    semantic_similarity = Column(Float, nullable=True)  # 0-100 (embedding cosine similarity, independent signal)
    verdict = Column(String, nullable=False)          # "Strong Match" / "Partial Match" / "Not a Match"
    summary = Column(Text, nullable=False)

    matched_keywords = Column(JSON, nullable=False)   # list[str]
    missing_keywords = Column(JSON, nullable=False)   # list[str]
    strengths = Column(JSON, nullable=False)           # list[str]
    gaps = Column(JSON, nullable=False)                 # list[str]
    breakdown = Column(JSON, nullable=False)            # {skills_match, experience_match, education_match}: 0-100 each

    interview_questions = Column(JSON, nullable=True)  # list[{question, why}], filled in lazily on request

    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    candidate = relationship("Candidate", back_populates="reports")
