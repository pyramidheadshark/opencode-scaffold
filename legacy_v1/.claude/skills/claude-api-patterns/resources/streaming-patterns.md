# Streaming Patterns — Claude API

## FastAPI SSE Endpoint

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import anthropic

app = FastAPI()
client = anthropic.Anthropic()

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": request.message}],
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {text}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

## HTMX Streaming with SSE

```html
<div hx-ext="sse" sse-connect="/chat/stream" sse-swap="message">
  Loading...
</div>
```

## Async Client

```python
import anthropic

async_client = anthropic.AsyncAnthropic()

async def stream_response(prompt: str):
    async with async_client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for text in stream.text_stream:
            yield text
```

## Token Counting Before Send

```python
count = client.messages.count_tokens(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": long_document}],
)
if count.input_tokens > 180_000:
    raise ValueError(f"Input too large: {count.input_tokens} tokens")
```
