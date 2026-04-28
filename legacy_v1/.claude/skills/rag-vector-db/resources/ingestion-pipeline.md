# Document Ingestion Pipeline

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
