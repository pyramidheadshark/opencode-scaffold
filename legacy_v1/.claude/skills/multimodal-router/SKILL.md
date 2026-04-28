# Multimodal Router

## When to Load This Skill

Load when working with: PDF files, Word documents, Excel spreadsheets, images, audio, video files, or any document exceeding 400k tokens that cannot fit in Claude's standard context.

## Model

- **Model**: `google/gemini-3-flash-preview`
- **Provider**: OpenRouter API
- **Context window**: 1M tokens
- **Capabilities**: text, images, audio, video, PDF — all natively
- **Thinking levels**: minimal / low / medium / high (configurable per task)

Gemini 3 Flash Preview is a thinking model with near-Pro reasoning at Flash latency.
Use `thinking_level: "low"` for document extraction, `"medium"` or `"high"` for complex analysis.

## When to Use This Skill (Decision Rules)

Use Gemini 3 Flash via this skill when:
- Input is a PDF, image, audio file, or video
- Input document exceeds ~400k tokens (rough estimate: 300+ pages of text)
- Task requires visual understanding (screenshots, diagrams, scanned docs)
- Client sent `.docx`, `.pdf`, `.xlsx`, `.mp4`, `.wav` for initial project analysis

Do NOT use for: writing code, architecture decisions, tests. Those stay with Claude Code.

## OpenRouter Client Pattern

```python
import httpx

from src.project_name.core.config import settings


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
MULTIMODAL_MODEL = "google/gemini-3-flash-preview"


async def call_gemini_flash(
    prompt: str,
    base64_content: str | None = None,
    media_type: str | None = None,
    thinking_level: str = "low",
) -> str:
    messages: list[dict] = []

    if base64_content and media_type:
        messages.append({
            "role": "user",
            "content": [
                {
                    "type": "image_url" if media_type.startswith("image") else "file",
                    "image_url": {"url": f"data:{media_type};base64,{base64_content}"},
                },
                {"type": "text", "text": prompt},
            ],
        })
    else:
        messages.append({"role": "user", "content": prompt})

    payload = {
        "model": MULTIMODAL_MODEL,
        "messages": messages,
        "reasoning": {"effort": thinking_level},
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "HTTP-Referer": "https://github.com/your-org/project",
                "X-Title": "ML Engineering Platform",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
```

## PDF Analysis Pattern

```python
import base64
from pathlib import Path


async def analyze_pdf(pdf_path: Path, analysis_prompt: str) -> str:
    pdf_bytes = pdf_path.read_bytes()
    b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    return await call_gemini_flash(
        prompt=analysis_prompt,
        base64_content=b64,
        media_type="application/pdf",
        thinking_level="medium",
    )
```

## Standard Analysis Prompts

For intake phase (analyzing client documents):

```python
INTAKE_SYSTEM_PROMPT = """
You are analyzing a client document to extract structured requirements.
Return a JSON object with these fields:
- business_goal: str
- key_stakeholders: list[str]
- data_sources: list[dict with name, format, volume]
- use_cases: list[str]
- constraints: list[str]
- open_questions: list[str]

Be thorough. Every ambiguity should appear in open_questions.
Return ONLY valid JSON, no markdown fences.
"""
```

## .env Keys Required

```
OPENROUTER_API_KEY=sk-or-...
```

## Cost Awareness

Gemini 3 Flash Preview pricing on OpenRouter: ~$0.0005/1k input tokens, ~$0.003/1k output.
A 300-page PDF (≈150k tokens) costs approximately $0.075 to analyze. Always reasonable.

For documents that need Pro-level reasoning (very complex technical analysis):
use `google/gemini-3-flash-preview` with `thinking_level: "high"` before escalating to Pro.
