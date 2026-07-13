"""
Semantic similarity between resume text and job description text, using
sentence-transformer embeddings.

This runs ALONGSIDE (not instead of) the LLM-based match analysis in
llm.py / recruitment_prompts.py:

- The LLM gives a reasoned, human-readable verdict: strengths, gaps,
  missing keywords, an interview-question set. It's flexible but it's a
  black box, costs an API call per run, and can vary slightly between
  runs of the same input.
- This module gives an independent, deterministic numeric signal: how
  close the two texts sit in embedding space. Zero API cost, fully
  reproducible, and it can't hallucinate a score.

Together they give recruiters two different lenses on the same question
("does this resume fit this JD?") -- one qualitative/LLM-reasoned, one
quantitative/geometric -- which is also why we store both on the report
instead of blending them into a single number.

Model: sentence-transformers/all-MiniLM-L6-v2 (~80MB, 384-dim). Chosen
because it's small enough to load in a couple seconds on a CPU-only
laptop while still being a standard baseline for semantic-search / STS
(semantic textual similarity) tasks -- not a toy TF-IDF bag-of-words
comparison.

The model downloads once from Hugging Face on first use and is cached
locally afterwards (~/.cache/huggingface). No API key needed.
"""

import re
from functools import lru_cache

from sentence_transformers import SentenceTransformer, util

MODEL_NAME = "all-MiniLM-L6-v2"
MAX_CHARS = 6000  # keeps encoding fast; resumes/JDs rarely carry useful signal past this


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    # Loaded once per process. The first call pays the ~1-2s load cost
    # (plus a one-time download on a fresh machine); every call after
    # that reuses the cached instance via lru_cache.
    return SentenceTransformer(MODEL_NAME)


def _clean(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return text[:MAX_CHARS]


def semantic_similarity(resume_text: str, jd_text: str) -> float:
    """
    Returns a 0-100 semantic similarity score between a resume and a job
    description, based on cosine similarity of their sentence embeddings.

    Raw cosine similarity between two pieces of professional text rarely
    lands outside roughly [0.15, 0.85] in practice -- even an unrelated
    resume/JD pair shares generic workplace vocabulary that keeps the
    floor well above 0, and no two independently-written documents hit a
    perfect 1.0. Mapping the raw [-1, 1] cosine range straight to
    [0, 100] would squash every real-world score into a narrow ~60-90
    band. Rescaling from that empirical [0.15, 0.85] band instead spreads
    scores across the full 0-100 range, which is what makes the number
    actually useful to compare across candidates.
    """
    model = _get_model()
    resume_clean, jd_clean = _clean(resume_text), _clean(jd_text)

    if not resume_clean or not jd_clean:
        return 0.0

    embeddings = model.encode([resume_clean, jd_clean], normalize_embeddings=True)
    raw_cosine = float(util.cos_sim(embeddings[0], embeddings[1]).item())

    low, high = 0.15, 0.85
    scaled = (raw_cosine - low) / (high - low)
    scaled = max(0.0, min(1.0, scaled))
    return round(scaled * 100, 1)
