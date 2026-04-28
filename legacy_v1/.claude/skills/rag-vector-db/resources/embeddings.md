# Embedding Adapters

## OpenRouter (API-based)

```python
import httpx
from src.project_name.core.config import settings


class EmbeddingAdapter:
    OPENROUTER_EMBED_URL = "https://openrouter.ai/api/v1/embeddings"

    async def embed(self, texts: list[str], model: str = "text-embedding-3-small") -> list[list[float]]:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.OPENROUTER_EMBED_URL,
                headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
                json={"model": model, "input": texts},
            )
            response.raise_for_status()
            data = response.json()
            return [item["embedding"] for item in data["data"]]

    async def embed_single(self, text: str) -> list[float]:
        results = await self.embed([text])
        return results[0]
```

## Local (sentence-transformers, no API cost)

`multilingual-e5-base` — best default for Russian, 768 dim, ~280MB.

```python
from sentence_transformers import SentenceTransformer


class LocalEmbeddingAdapter:
    def __init__(self, model_name: str = "intfloat/multilingual-e5-base") -> None:
        self._model = SentenceTransformer(model_name)

    def embed(self, texts: list[str]) -> list[list[float]]:
        return self._model.encode(texts, normalize_embeddings=True).tolist()
```
