# Chunking Strategies

Chunking is the most critical RAG quality parameter. Bad chunking = bad retrieval.

## Paragraph-based chunking (default)

```python
from dataclasses import dataclass


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

    for para in paragraphs:
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

## Chunk size guidelines

| Document type | max_tokens | overlap |
|---|---|---|
| Technical docs | 256–512 | 1 sentence |
| Legal / contracts | 512–1024 | 2 sentences |
| Short FAQ | 128–256 | 0 |
