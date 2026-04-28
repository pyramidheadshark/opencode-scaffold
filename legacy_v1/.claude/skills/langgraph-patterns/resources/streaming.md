# Streaming Responses from LangGraph

## SSE via FastAPI

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import json

router = APIRouter()


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    graph = get_graph()
    config = {"configurable": {"thread_id": request.thread_id}}

    async def event_generator():
        async for chunk in graph.astream(
            {"user_input": request.message, "messages": []},
            config=config,
            stream_mode="values",
        ):
            if "final_answer" in chunk and chunk["final_answer"]:
                data = json.dumps({"type": "answer", "content": chunk["final_answer"]})
                yield f"data: {data}\n\n"

        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

## HTMX SSE Integration

```html
<div hx-ext="sse" sse-connect="/pages/chat/stream" sse-swap="message">
    <div id="chat-response"></div>
</div>
```

Requires `htmx-ext-sse` extension — include in templates:
```html
<script src="/static/htmx-ext-sse.js"></script>
```
