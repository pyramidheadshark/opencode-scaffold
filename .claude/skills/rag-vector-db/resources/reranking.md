# Cross-Encoder Reranking

## Why Rerank

Bi-encoder (embedding) retrieval оптимизирован для скорости — он ищет по косинусному расстоянию в векторном пространстве. Но он плохо улавливает точное семантическое соответствие между запросом и документом.

Cross-encoder читает запрос и документ вместе и даёт более точный score релевантности. Используется как второй проход: сначала bi-encoder достаёт top-20, потом cross-encoder переранжирует и отдаёт top-5.

## Cross-Encoder Adapter

```python
from sentence_transformers import CrossEncoder


class RerankerAdapter:
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2") -> None:
        self._model = CrossEncoder(model_name, max_length=512)

    def rerank(
        self,
        query: str,
        documents: list[dict],
        text_key: str = "text",
        top_k: int = 5,
    ) -> list[dict]:
        pairs = [[query, doc[text_key]] for doc in documents]
        scores = self._model.predict(pairs)

        ranked = sorted(
            zip(scores, documents),
            key=lambda x: x[0],
            reverse=True,
        )
        return [doc for _, doc in ranked[:top_k]]
```

Для русского языка: `cross-encoder/msmarco-MiniLM-L6-en-de` работает удовлетворительно,
но лучше использовать `DiTy/cross-encoder-russian-msmarco` если качество критично.

## Integration in RAG Pipeline

```python
class RAGService:
    def __init__(self, vector_db, embedder, reranker, llm_adapter) -> None:
        self._db = vector_db
        self._embedder = embedder
        self._reranker = reranker
        self._llm = llm_adapter

    async def answer(self, question: str) -> dict:
        query_embedding = self._embedder.embed([question])[0]
        candidates = await self._db.search(query_embedding, top_k=20)
        reranked = self._reranker.rerank(question, candidates, top_k=5)

        context = "\n\n---\n\n".join(r["text"] for r in reranked)
        answer = await self._llm.invoke(
            system="Answer based only on the provided context.",
            messages=[{"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}],
        )
        return {"answer": answer, "sources": [r["source"] for r in reranked]}
```
