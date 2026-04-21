# Claude API Patterns

## When to Load This Skill

Load when working with: Anthropic SDK, `anthropic` package, Claude API, tool use, streaming responses, message batches, `MessageCreate`, `@anthropic-ai/sdk`.

## SDK Setup

```python
import anthropic

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
```

Never hardcode the API key. Always use environment variables validated at startup.

## Basic Message

```python
message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": prompt}],
)
return message.content[0].text
```

## System Prompt

```python
message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=2048,
    system=system_prompt,
    messages=[{"role": "user", "content": user_message}],
)
```

Keep system prompts in separate `.txt` or `.md` files, not inline strings. Version them.

## Streaming

```python
with client.messages.stream(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": prompt}],
) as stream:
    for text in stream.text_stream:
        yield text
```

Use streaming for: long responses, real-time UX, progress indication.

## Tool Use (Function Calling)

```python
from pydantic import BaseModel

class SearchInput(BaseModel):
    query: str
    max_results: int = 10

tools = [{
    "name": "search",
    "description": "Search for information",
    "input_schema": SearchInput.model_json_schema(),
}]

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "Find recent papers on RAG"}],
)
```

Always define tool schemas with Pydantic — never write raw JSON schemas by hand.

## Tool Result Loop

```python
messages = [{"role": "user", "content": user_message}]

while True:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        tools=tools,
        messages=messages,
    )

    if response.stop_reason == "end_turn":
        break

    if response.stop_reason == "tool_use":
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = dispatch_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})
```

## Observability

Log every call:
- model, max_tokens, stop_reason
- input_tokens, output_tokens (from `response.usage`)
- latency (wall time)
- cost estimate (use token counts × price per token)

```python
import time

start = time.monotonic()
response = client.messages.create(...)
latency_ms = (time.monotonic() - start) * 1000

logger.info("claude_call", extra={
    "model": response.model,
    "input_tokens": response.usage.input_tokens,
    "output_tokens": response.usage.output_tokens,
    "stop_reason": response.stop_reason,
    "latency_ms": round(latency_ms, 1),
})
```

## Rate Limits and Retry

```python
import anthropic

client = anthropic.Anthropic(
    max_retries=3,
)
```

The SDK retries on 429 and 529 by default. For production, add exponential backoff via `httpx` transport or a wrapper. Never swallow `anthropic.APIError` silently.

## Model Selection

| Task | Model |
|------|-------|
| Code, architecture, tests | `claude-sonnet-4-6` |
| Complex reasoning, long docs | `claude-opus-4-7` |
| Fast classification, routing | `claude-haiku-4-5-20251001` |

Routing must be explicit in code — never auto-escalate based on vague heuristics.

## See Also

- `resources/streaming-patterns.md` — advanced streaming with SSE + FastAPI
- `resources/eval-design.md` — building evals for prompt changes
