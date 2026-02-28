# pgvector Alternative

Use when: already have PostgreSQL, simple use case, don't want an extra service.

## Setup

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

## Search function

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
