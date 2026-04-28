# Advanced Dependency Injection in FastAPI

## Scoped Dependencies

FastAPI DI поддерживает три скоупа: `request` (default), `lifespan`, и `yield`.

### Request-scoped (default)

Новый экземпляр на каждый запрос. Подходит для большинства сервисов.

```python
from fastapi import Depends


def get_item_service() -> ItemService:
    return ItemService()


@router.get("/items")
async def list_items(service: ItemService = Depends(get_item_service)):
    return await service.list_all()
```

### Lifespan-scoped (singleton)

Один экземпляр на весь жизненный цикл приложения. Подходит для дорогих объектов: DB пул, ML-модель, HTTP-клиент.

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
import httpx


class AppState:
    http_client: httpx.AsyncClient
    ml_model: OnnxInferenceAdapter


app_state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app_state.http_client = httpx.AsyncClient(timeout=30.0)
    app_state.ml_model = OnnxInferenceAdapter(Path("models/weights/model.onnx"))
    yield
    await app_state.http_client.aclose()


def get_http_client() -> httpx.AsyncClient:
    return app_state.http_client


def get_ml_model() -> OnnxInferenceAdapter:
    return app_state.ml_model
```

### Yield Dependencies (resource cleanup)

```python
from sqlalchemy.ext.asyncio import AsyncSession
from src.project_name.adapters.db.session import async_session_factory


async def get_db_session() -> AsyncSession:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@router.post("/items")
async def create_item(
    payload: ItemCreate,
    session: AsyncSession = Depends(get_db_session),
) -> ItemResponse:
    ...
```

## Dependency Overriding in Tests

```python
from fastapi.testclient import TestClient
from src.project_name.main import app


def get_mock_service() -> ItemService:
    return MockItemService()


app.dependency_overrides[get_item_service] = get_mock_service

client = TestClient(app)
```

## Settings as Dependency

```python
from functools import lru_cache
from src.project_name.core.config import Settings


@lru_cache
def get_settings() -> Settings:
    return Settings()


@router.get("/config")
async def show_config(settings: Settings = Depends(get_settings)) -> dict:
    return {"env": settings.environment}
```
