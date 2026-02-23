FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_NO_PROGRESS=1 \
    UV_SYSTEM_PYTHON=1

RUN pip install uv

WORKDIR /app

FROM base AS builder

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

FROM base AS runtime

COPY --from=builder /app/.venv /app/.venv
COPY src/ ./src/

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "src.project_name.main:app", "--host", "0.0.0.0", "--port", "8000"]
