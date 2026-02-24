# RAG & Vector DB Patterns

## When to Load This Skill

Load when working with: Qdrant, pgvector, embeddings, chunking, retrieval-augmented generation, semantic search, knowledge bases, document ingestion pipelines.

## Vector DB Choice

| Option | When to Use |
|---|---|
| **Qdrant** | Default choice. Standalone service, excellent filtering, production-ready, Docker-friendly |
| **pgvector** | Already have PostgreSQL, simple use case, don't want extra service |
| **In-memory (numpy)** | Prototyping only, < 10k documents |

## Qdrant Setup

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  qdrant_data:
```

## Qdrant Adapter

```python
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams, Filter, FieldCondition, MatchValue
import uuid

from src.project_name.core.config import settings


class QdrantAdapter:
    def __init__(self) -> None:
        self._client = AsyncQdrantClient(url=settings.qdrant_url)
        self._collection = settings.qdrant_collection

    async def ensure_collection(self, vector_size: int) -> None:
        collections = await self._client.get_collections()
        names = [c.name for c in collections.collections]
        if self._collection not in names:
            await self._client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )

    async def upsert(self, chunks: list[dict], embeddings: list[list[float]]) -> None:
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=emb,
                payload=chunk,
            )
            for chunk, emb in zip(chunks, embeddings)
        ]
        await self._client.upsert(collection_name=self._collection, points=points)

    async def search(
        self,
        query_vector: list[float],
        top_k: int = 5,
        filter_by: dict | None = None,
    ) -> list[dict]:
        query_filter = None
        if filter_by:
            query_filter = Filter(
                must=[
                    FieldCondition(key=k, match=MatchValue(value=v))
                    for k, v in filter_by.items()
                ]
            )
        results = await self._client.search(
            collection_name=self._collection,
            query_vector=query_vector,
            limit=top_k,
            query_filter=query_filter,
            with_payload=True,
        )
        return [{"score": r.score, **r.payload} for r in results]
```

Required `.env`:
```
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=knowledge_base
```

## Embedding Adapter

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

For local embeddings (no API cost), use `sentence-transformers`:

```python
from sentence_transformers import SentenceTransformer


class LocalEmbeddingAdapter:
    def __init__(self, model_name: str = "intfloat/multilingual-e5-base") -> None:
        self._model = SentenceTransformer(model_name)

    def embed(self, texts: list[str]) -> list[list[float]]:
        return self._model.encode(texts, normalize_embeddings=True).tolist()
```

`multilingual-e5-base` — хороший дефолт для русского языка, 768 dim, ~280MB.

## Chunking Strategy

Chunking — наиболее критичный параметр качества RAG. Плохой chunking = плохой retrieval.

```python
from dataclasses import dataclass
from typing import Iterator


@dataclass
class Chunk:
    text: str
    source: str
    page: int | None
    chunk_index: int
    metadata: dict


def chunk_by_paragraph(
    text: str,
    source: str,
    max_tokens: int = 512,
    overlap_sentences: int = 1,
) -> list[Chunk]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current = []
    current_len = 0

    for i, para in enumerate(paragraphs):
        para_len = len(para.split())
        if current_len + para_len > max_tokens and current:
            chunk_text = "\n\n".join(current)
            chunks.append(Chunk(
                text=chunk_text,
                source=source,
                page=None,
                chunk_index=len(chunks),
                metadata={"paragraph_count": len(current)},
            ))
            current = current[-overlap_sentences:] if overlap_sentences else []
            current_len = sum(len(p.split()) for p in current)
        current.append(para)
        current_len += para_len

    if current:
        chunks.append(Chunk(
            text="\n\n".join(current),
            source=source,
            page=None,
            chunk_index=len(chunks),
            metadata={"paragraph_count": len(current)},
        ))

    return chunks
```

## Document Ingestion Pipeline

```python
from pathlib import Path


class IngestionService:
    def __init__(
        self,
        vector_db: QdrantAdapter,
        embedder: LocalEmbeddingAdapter,
    ) -> None:
        self._db = vector_db
        self._embedder = embedder

    async def ingest_docx(self, path: Path) -> int:
        from docx import Document
        doc = Document(str(path))
        full_text = "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        return await self._ingest_text(full_text, source=path.name)

    async def ingest_pdf(self, path: Path) -> int:
        import pdfplumber
        pages_text = []
        with pdfplumber.open(str(path)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
        full_text = "\n\n".join(pages_text)
        return await self._ingest_text(full_text, source=path.name)

    async def _ingest_text(self, text: str, source: str) -> int:
        chunks = chunk_by_paragraph(text, source=source)
        if not chunks:
            return 0
        texts = [c.text for c in chunks]
        embeddings = self._embedder.embed(texts)
        payloads = [{"text": c.text, "source": c.source, "chunk_index": c.chunk_index, **c.metadata} for c in chunks]
        await self._db.upsert(payloads, embeddings)
        return len(chunks)
```

## RAG Query Pipeline

```python
class RAGService:
    def __init__(
        self,
        vector_db: QdrantAdapter,
        embedder: LocalEmbeddingAdapter,
        llm_adapter,
    ) -> None:
        self._db = vector_db
        self._embedder = embedder
        self._llm = llm_adapter

    async def answer(self, question: str, top_k: int = 5) -> dict:
        query_embedding = self._embedder.embed([question])[0]
        retrieved = await self._db.search(query_embedding, top_k=top_k)

        if not retrieved:
            return {"answer": "Информация не найдена в базе знаний.", "sources": []}

        context = "\n\n---\n\n".join(r["text"] for r in retrieved)
        sources = list({r["source"] for r in retrieved})

        answer = await self._llm.invoke(
            system="Answer based only on the provided context. If the answer is not in the context, say so explicitly.",
            messages=[{"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}],
        )

        return {"answer": answer, "sources": sources, "retrieved_count": len(retrieved)}
```

## pgvector Alternative

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    embedding vector(768),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

```python
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def pgvector_search(
    session: AsyncSession,
    query_embedding: list[float],
    top_k: int = 5,
) -> list[dict]:
    result = await session.execute(
        text("""
            SELECT content, source, metadata,
                   1 - (embedding <=> :embedding) AS similarity
            FROM documents
            ORDER BY embedding <=> :embedding
            LIMIT :k
        """),
        {"embedding": str(query_embedding), "k": top_k},
    )
    return [dict(row._mapping) for row in result]
```

## Further Resources

- `resources/reranking.md` — cross-encoder reranking для улучшения precision
- `resources/eval-ragas.md` — оценка качества RAG с RAGAS framework
