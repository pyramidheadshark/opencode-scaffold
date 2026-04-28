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

Full adapter implementation: `resources/qdrant-adapter.md`

## Embeddings

Two options:

- **OpenRouter** (`text-embedding-3-small`) — API-based, no local GPU required
- **sentence-transformers** (`multilingual-e5-base`, 768 dim, ~280MB) — local, free, good for Russian

Full implementations: `resources/embeddings.md`

## Chunking

Chunking is the most critical RAG quality parameter. Default: paragraph-based, 512 tokens, 1-sentence overlap.

Full strategy + `Chunk` dataclass: `resources/chunking-strategies.md`

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
            return {"answer": "No information found in knowledge base.", "sources": []}

        context = "\n\n---\n\n".join(r["text"] for r in retrieved)
        sources = list({r["source"] for r in retrieved})

        answer = await self._llm.invoke(
            system="Answer based only on the provided context. If the answer is not in the context, say so explicitly.",
            messages=[{"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}],
        )

        return {"answer": answer, "sources": sources, "retrieved_count": len(retrieved)}
```

## Document Ingestion

Full `IngestionService` (PDF + DOCX): `resources/ingestion-pipeline.md`

## pgvector Alternative

SQL setup + search function: `resources/pgvector-alternative.md`

## Further Resources

- `resources/reranking.md` — cross-encoder reranking for precision improvement
- `resources/eval-ragas.md` — RAG quality evaluation with RAGAS framework
