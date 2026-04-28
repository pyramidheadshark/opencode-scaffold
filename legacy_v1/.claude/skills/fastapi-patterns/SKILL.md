# FastAPI Patterns

## When to Load This Skill

Load when working with: FastAPI routers, Pydantic models, dependency injection, middleware, ASGI lifecycle, HTTP endpoints, background tasks.

## Architectural Contract

All FastAPI projects follow Hexagonal Architecture:

```
api/          → adapters IN  (HTTP boundary)
core/         → domain       (pure Python, zero framework imports)
services/     → application  (orchestrates core + adapters)
adapters/     → adapters OUT (DB, LLM, S3, external APIs)
models/       → schemas      (Pydantic — request, response, internal)
```

The `core/` layer MUST NOT import from `fastapi`, `sqlalchemy`, or any adapter library.
The `api/` layer MUST NOT contain business logic — only validation and routing.

## Application Entry Point

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.project_name.api.routers import health, items
from src.project_name.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
    )
    app.include_router(health.router, prefix="/health", tags=["health"])
    app.include_router(items.router, prefix="/api/v1/items", tags=["items"])
    return app


app = create_app()
```

## Router Pattern

```python
from fastapi import APIRouter, Depends, HTTPException, status

from src.project_name.models.item import ItemCreate, ItemResponse
from src.project_name.services.item_service import ItemService

router = APIRouter()


def get_item_service() -> ItemService:
    return ItemService()


@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreate,
    service: ItemService = Depends(get_item_service),
) -> ItemResponse:
    return await service.create(payload)
```

## Service Layer Pattern

```python
from src.project_name.adapters.item_repository import ItemRepository
from src.project_name.core.domain import Item
from src.project_name.models.item import ItemCreate, ItemResponse


class ItemService:
    def __init__(self, repository: ItemRepository | None = None) -> None:
        self._repo = repository or ItemRepository()

    async def create(self, payload: ItemCreate) -> ItemResponse:
        domain_item = Item.from_create(payload)
        saved = await self._repo.save(domain_item)
        return ItemResponse.model_validate(saved)
```

## Pydantic Models Convention

```python
from pydantic import BaseModel, Field


class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None


class ItemResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    description: str | None
```

## Error Handling

```python
from fastapi import Request
from fastapi.responses import JSONResponse

from src.project_name.core.exceptions import DomainError, NotFoundError


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})
```

Register in `create_app()`:
```python
app.add_exception_handler(DomainError, domain_error_handler)
app.add_exception_handler(NotFoundError, not_found_handler)
```

## HTMX Integration

When HTMX is needed, see `htmx-frontend` skill. Key principle: HTMX routes live in a separate router (`api/routers/pages.py`) and return `HTMLResponse` / Jinja2 `TemplateResponse`. JSON API routes stay clean and separate.

## Health Check (Standard)

```python
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})
```

## Running with uvicorn

```bash
uv run uvicorn src.project_name.main:app --reload --host 0.0.0.0 --port 8000
```

## Further Resources

- `resources/dependency-injection.md` — advanced DI patterns
- `resources/background-tasks.md` — async background jobs
- `resources/middleware.md` — CORS, logging, request ID middleware

## Streaming & Async Patterns

### Server-Sent Events (SSE) for LLM Streaming

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio

router = APIRouter()


async def token_generator(prompt: str):
    async for token in llm_service.stream(prompt):
        yield f"data: {token}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/stream")
async def stream_response(request: PromptRequest) -> StreamingResponse:
    return StreamingResponse(
        token_generator(request.prompt),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

### WebSocket Pattern

```python
from fastapi import WebSocket, WebSocketDisconnect

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            async for token in llm_service.stream(data):
                await websocket.send_text(token)
    except WebSocketDisconnect:
        pass
```

### Async Background Tasks

```python
from fastapi import BackgroundTasks

async def process_batch(job_id: str, records: list[dict]) -> None:
    result = await ml_service.run(records)
    await job_store.save(job_id, result)


@router.post("/jobs")
async def create_job(
    payload: BatchRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    job_id = str(uuid4())
    background_tasks.add_task(process_batch, job_id, payload.records)
    return {"job_id": job_id, "status": "queued"}
```

### Streaming Response from Anthropic Claude

```python
from anthropic import AsyncAnthropic

client = AsyncAnthropic()


async def claude_token_generator(prompt: str):
    async with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for text in stream.text_stream:
            yield f"data: {text}\n\n"
    yield "data: [DONE]\n\n"
```
