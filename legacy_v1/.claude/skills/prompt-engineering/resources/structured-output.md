# Structured Output Patterns

## Pydantic + JSON Mode

```python
from pydantic import BaseModel, ValidationError
import json

class AnalysisResult(BaseModel):
    summary: str
    sentiment: str
    confidence: float
    key_points: list[str]

def analyze(text: str) -> AnalysisResult:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system="""Analyze the text and return JSON matching this schema:
{
  "summary": "1-2 sentence summary",
  "sentiment": "positive|negative|neutral",
  "confidence": 0.0-1.0,
  "key_points": ["point1", "point2"]
}
Return ONLY valid JSON, no markdown, no explanation.""",
        messages=[{"role": "user", "content": text}],
    )
    raw = response.content[0].text.strip()
    try:
        return AnalysisResult.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as e:
        raise ValueError(f"Invalid model output: {e}\nRaw: {raw}") from e
```

## Retry on Validation Failure

```python
import anthropic

def analyze_with_retry(text: str, max_retries: int = 2) -> AnalysisResult:
    messages = [{"role": "user", "content": text}]

    for attempt in range(max_retries + 1):
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=messages,
        )
        raw = response.content[0].text.strip()
        try:
            return AnalysisResult.model_validate(json.loads(raw))
        except (json.JSONDecodeError, ValidationError) as e:
            if attempt == max_retries:
                raise
            messages.append({"role": "assistant", "content": raw})
            messages.append({
                "role": "user",
                "content": f"Your response was invalid: {e}. Please return ONLY valid JSON.",
            })
```

## XML for Complex Nested Output

When JSON is unreliable for very nested structures, use XML tags:

```python
SYSTEM = """Extract entities from the text. Use this format:
<entities>
  <entity type="person" confidence="0.9">John Smith</entity>
  <entity type="org" confidence="0.8">Acme Corp</entity>
</entities>"""
```

Parse with `xml.etree.ElementTree`.
