# Background Tasks in FastAPI

## When to Use

Background tasks выполняются после отправки ответа клиенту. Подходят для:
- Отправки уведомлений (email, Telegram)
- Асинхронной записи в лог/аудит
- Webhook-вызовов после завершения операции

Не подходят для долгих задач (> 30 секунд) — используй Celery или ARQ.

## FastAPI BackgroundTasks Pattern

```python
from fastapi import APIRouter, BackgroundTasks

router = APIRouter()


async def send_notification(user_id: str, message: str) -> None:
    await notification_adapter.send(user_id, message)


@router.post("/items")
async def create_item(
    payload: ItemCreate,
    background_tasks: BackgroundTasks,
    service=Depends(get_item_service),
) -> ItemResponse:
    item = await service.create(payload)
    background_tasks.add_task(send_notification, payload.user_id, f"Item {item.id} created")
    return ItemResponse.from_orm(item)
```

## ARQ for Persistent Job Queues

Если задача должна пережить рестарт сервера или выполняться по расписанию, используй ARQ (async Redis queue):

```python
from arq import create_pool
from arq.connections import RedisSettings


async def send_report(ctx: dict, user_id: str) -> None:
    await report_service.generate_and_send(user_id)


class WorkerSettings:
    functions = [send_report]
    redis_settings = RedisSettings(host="localhost", port=6379)


async def enqueue_report(user_id: str) -> None:
    redis = await create_pool(RedisSettings())
    await redis.enqueue_job("send_report", user_id)
```

Required in `docker-compose.yml`:
```yaml
services:
  worker:
    build: .
    command: arq src.project_name.worker.WorkerSettings
    env_file: .env
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```
