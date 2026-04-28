# NLP / SLM Patterns

## When to Load This Skill

Load when working with: local language models, anonymization/PII detection, text classification, NER, Ollama, vLLM, Presidio, spaCy, Hugging Face Transformers, SLM inference pipelines.

## Philosophy

Local models run locally during development, then deploy to YC GPU VM for production. The adapter interface is identical in both environments — only the endpoint URL changes via `.env`.

Anonymization projects deal with real personal data. Default posture: treat all input as sensitive until proven otherwise. Never log raw text containing PII.

## Model Serving Options

| Option | When to Use | Infra |
|---|---|---|
| **Ollama** | Local dev, prototyping, CPU-only inference | Docker container, local |
| **vLLM** | Production GPU inference, high throughput needed | YC GPU VM |
| **Transformers (direct)** | Fine-tuned models, custom pipelines, offline only | Local or GPU VM |

## Ollama Local Setup

```python
import httpx
from src.project_name.core.config import settings


class OllamaAdapter:
    def __init__(self) -> None:
        self._base_url = settings.ollama_base_url
        self._model = settings.ollama_model

    async def generate(self, prompt: str, system: str = "") -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self._base_url}/api/generate",
                json={
                    "model": self._model,
                    "prompt": prompt,
                    "system": system,
                    "stream": False,
                },
            )
            response.raise_for_status()
            return response.json()["response"]

    async def chat(self, messages: list[dict]) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self._base_url}/api/chat",
                json={"model": self._model, "messages": messages, "stream": False},
            )
            response.raise_for_status()
            return response.json()["message"]["content"]
```

Required `.env`:
```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

Docker Compose for Ollama:
```yaml
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

volumes:
  ollama_data:
```

## vLLM Production Setup

```python
from openai import AsyncOpenAI
from src.project_name.core.config import settings


class VLLMAdapter:
    def __init__(self) -> None:
        self._client = AsyncOpenAI(
            api_key="EMPTY",
            base_url=settings.vllm_base_url,
        )
        self._model = settings.vllm_model_name

    async def generate(self, prompt: str, system: str = "", max_tokens: int = 1024) -> str:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=0.1,
        )
        return response.choices[0].message.content or ""
```

Required `.env` (production):
```
VLLM_BASE_URL=http://your-gpu-vm-ip:8000/v1
VLLM_MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
```

vLLM launch command on GPU VM:
```bash
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --port 8000 \
  --tensor-parallel-size 1 \
  --max-model-len 32768
```

## Anonymization with Presidio

Microsoft Presidio is the standard for PII detection and anonymization. It supports custom recognizers and operators.

```python
from presidio_analyzer import AnalyzerEngine, RecognizerResult
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig


class AnonymizationAdapter:
    def __init__(self) -> None:
        self._analyzer = AnalyzerEngine()
        self._anonymizer = AnonymizerEngine()

    def analyze(self, text: str, language: str = "ru") -> list[RecognizerResult]:
        return self._analyzer.analyze(text=text, language=language)

    def anonymize(self, text: str, language: str = "ru") -> str:
        results = self.analyze(text, language)
        anonymized = self._anonymizer.anonymize(
            text=text,
            analyzer_results=results,
            operators={
                "PERSON": OperatorConfig("replace", {"new_value": "<PERSON>"}),
                "PHONE_NUMBER": OperatorConfig("replace", {"new_value": "<PHONE>"}),
                "EMAIL_ADDRESS": OperatorConfig("replace", {"new_value": "<EMAIL>"}),
                "LOCATION": OperatorConfig("replace", {"new_value": "<LOCATION>"}),
            },
        )
        return anonymized.text
```

Required dependencies:
```toml
dependencies = [
    "presidio-analyzer>=2.2.0",
    "presidio-anonymizer>=2.2.0",
    "spacy>=3.7.0",
]
```

Install spaCy Russian model:
```bash
uv run python -m spacy download ru_core_news_sm
uv run python -m spacy download en_core_web_sm
```

## Custom Presidio Recognizer

For domain-specific entities (e.g., employee IDs, contract numbers):

```python
from presidio_analyzer import PatternRecognizer, Pattern


class EmployeeIdRecognizer(PatternRecognizer):
    PATTERNS = [Pattern("EMPLOYEE_ID", r"\bEMP-\d{6}\b", 0.85)]
    CONTEXT = ["employee", "id", "сотрудник"]

    def __init__(self) -> None:
        super().__init__(
            supported_entity="EMPLOYEE_ID",
            patterns=self.PATTERNS,
            context=self.CONTEXT,
        )
```

Register with analyzer:
```python
from presidio_analyzer import AnalyzerEngine

analyzer = AnalyzerEngine()
analyzer.registry.add_recognizer(EmployeeIdRecognizer())
```

## Transformers Inference Pipeline

```python
from pathlib import Path
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline


class TextClassifierAdapter:
    def __init__(self, model_path: str | Path) -> None:
        self._pipeline = pipeline(
            "text-classification",
            model=str(model_path),
            tokenizer=str(model_path),
            device=0 if torch.cuda.is_available() else -1,
            top_k=None,
        )

    def classify(self, text: str) -> list[dict]:
        results = self._pipeline(text, truncation=True, max_length=512)
        return sorted(results[0], key=lambda x: x["score"], reverse=True)
```

## Privacy Rules

- Never log raw user text in production — log only metadata (length, language, entity counts)
- Anonymize before storing any text in database
- Use `ANONYMIZED_TEXT` column naming convention to signal anonymized content
- Test anonymization with synthetic PII — never use real personal data in tests

## Further Resources

- `resources/spacy-ner.md` — custom NER with spaCy
- `resources/model-quantization.md` — GGUF/AWQ quantization for local inference
