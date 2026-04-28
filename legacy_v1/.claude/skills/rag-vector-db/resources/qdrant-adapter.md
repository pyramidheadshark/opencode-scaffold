# Qdrant Adapter

Required `.env`:
```
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=knowledge_base
```

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
