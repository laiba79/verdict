from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ---- Job Descriptions ----

class JobDescriptionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    department: str | None = None
    raw_text: str = Field(..., min_length=20, max_length=20_000)


class JobDescriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    department: str | None
    raw_text: str
    created_at: datetime
    candidate_count: int = 0


# ---- Candidates ----

class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_description_id: int
    full_name: str | None
    file_name: str
    created_at: datetime


# ---- Match Reports ----

class Breakdown(BaseModel):
    skills_match: float
    experience_match: float
    education_match: float


class MatchReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_id: int
    match_score: float
    semantic_similarity: float | None = None
    verdict: str
    summary: str
    matched_keywords: list[str]
    missing_keywords: list[str]
    strengths: list[str]
    gaps: list[str]
    breakdown: Breakdown
    interview_questions: list[dict] | None = None
    created_at: datetime


class RankingEntry(BaseModel):
    candidate_id: int
    candidate_name: str | None
    file_name: str
    match_score: float
    verdict: str
    report_id: int


class RankingOut(BaseModel):
    job_description_id: int
    job_title: str
    ranking: list[RankingEntry]


# ---- Bias Checker ----

class BiasCheckRequest(BaseModel):
    raw_text: str = Field(..., min_length=20, max_length=20_000)


class BiasFlag(BaseModel):
    phrase: str
    category: str
    why: str
    suggestion: str


class BiasCheckOut(BaseModel):
    overall_risk: str
    summary: str
    flags: list[BiasFlag]


# ---- Pipeline Snapshot (dashboard widget) ----

class VerdictCount(BaseModel):
    verdict: str
    count: int


class PipelineSnapshotOut(BaseModel):
    open_job_descriptions: int
    candidates_uploaded: int
    reports_generated: int
    average_match_score: float | None
    verdict_breakdown: list[VerdictCount]
    top_missing_keywords: list[str]


# ---- Resume Doctor ----

class SectionSuggestion(BaseModel):
    section: str
    suggestion: str


class ResumeDoctorOut(BaseModel):
    overall_feedback: str
    missing_keywords_to_add: list[str]
    section_suggestions: list[SectionSuggestion]
    rewrite_example: str
