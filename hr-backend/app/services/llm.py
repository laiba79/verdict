"""
Shared Groq client for the recruitment module (resume matching, bias
checking, interview questions, resume doctor). Separate from
app/routers/chatbot.py's own Groq call because that one is plain-text chat;
everything here needs strict, parseable JSON back, so it turns on Groq's
JSON mode and centralizes the parsing/error-handling for it.
"""

import json

import httpx
from fastapi import HTTPException

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


async def call_groq_json(
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    model: str,
    max_tokens: int = 2000,
) -> dict:
    """Calls Groq's OpenAI-compatible chat completions endpoint in JSON
    mode and returns the parsed dict. Raises HTTPException on any failure
    so routers don't each need their own error handling."""

    async with httpx.AsyncClient(timeout=45.0) as client:
        try:
            resp = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.2,
                    "max_tokens": max_tokens,
                    "response_format": {"type": "json_object"},
                },
            )
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="The AI provider took too long to respond. Please try again.")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="The AI provider returned an error. Please try again.")

    data = resp.json()
    try:
        raw = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="The AI provider returned an unexpected response.")

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="The AI provider returned malformed data. Please try again.")
