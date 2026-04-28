# Middleware Patterns for FastAPI

## Request ID Middleware

Добавляет уникальный ID к каждому запросу — критично для трассировки в логах.

```python
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
```

## Structured Logging Middleware

```python
import time
import logging
import json
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        log_data = {
            "request_id": getattr(request.state, "request_id", "-"),
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
        }
        logger.info(json.dumps(log_data, ensure_ascii=False))
        return response
```

## CORS Middleware

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

`.env`:
```
ALLOWED_ORIGINS=["http://localhost:3000","https://yourdomain.com"]
```

## Registration Order

Middleware executes in reverse registration order (last registered = first executed):

```python
app.add_middleware(LoggingMiddleware)       # executed second
app.add_middleware(RequestIdMiddleware)    # executed first (request_id available for logging)
app.add_middleware(CORSMiddleware, ...)    # executed third
```

## Logging Configuration

```python
import logging
import sys


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        stream=sys.stdout,
        level=getattr(logging, level.upper()),
        format="%(message)s",
    )
    logging.getLogger("uvicorn.access").disabled = True
```

Call in `lifespan` before app startup.
