# LangGraph Patterns

## When to Load This Skill

Load when working with: LangGraph state machines, agent nodes, tool definitions, checkpointers, human-in-the-loop interrupts, multi-agent coordination.

## Current Version

LangGraph `>=0.2.0` (langgraph-checkpoint for persistence).
Always pin exact version in `pyproject.toml`.

## Core Concepts

LangGraph models agent workflows as directed graphs:
- **State**: typed dict passed between nodes (the single source of truth)
- **Nodes**: Python async functions that receive and return state updates
- **Edges**: routing logic — conditional or unconditional
- **Checkpointer**: persistence layer for long-running agents (SQLite locally, PostgreSQL in production)

## Standard Project Structure

```
src/{project_name}/
├── agents/
│   ├── __init__.py
│   ├── graph.py           # graph assembly
│   ├── state.py           # TypedDict state definition
│   ├── nodes/
│   │   ├── __init__.py
│   │   ├── analyst.py
│   │   └── writer.py
│   └── tools/
│       ├── __init__.py
│       └── search.py
```

## State Definition Pattern

```python
from typing import Annotated
from typing_extensions import TypedDict
import operator


class AgentState(TypedDict):
    messages: Annotated[list[dict], operator.add]
    user_input: str
    retrieved_context: list[str]
    final_answer: str | None
    error: str | None
    iteration_count: int
```

Use `Annotated[list, operator.add]` for lists that nodes append to.
Use plain types for values that nodes replace entirely.

## Node Pattern

```python
from langchain_core.messages import AIMessage

from src.project_name.agents.state import AgentState
from src.project_name.adapters.llm.claude_adapter import ClaudeAdapter


async def analyst_node(state: AgentState) -> dict:
    adapter = ClaudeAdapter()
    response = await adapter.invoke(
        system="You are a precise analyst. Answer based only on retrieved context.",
        messages=state["messages"],
        context=state["retrieved_context"],
    )
    return {
        "messages": [AIMessage(content=response)],
        "final_answer": response,
    }
```

Nodes return ONLY the fields they modify — LangGraph merges the rest automatically.

## Graph Assembly Pattern

```python
from langgraph.graph import END, StateGraph
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from src.project_name.agents.state import AgentState
from src.project_name.agents.nodes.analyst import analyst_node
from src.project_name.agents.nodes.retriever import retriever_node


def should_continue(state: AgentState) -> str:
    if state.get("error"):
        return "handle_error"
    if state.get("final_answer"):
        return END
    return "analyst"


def build_graph(checkpointer=None) -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("retriever", retriever_node)
    graph.add_node("analyst", analyst_node)

    graph.set_entry_point("retriever")
    graph.add_edge("retriever", "analyst")
    graph.add_conditional_edges("analyst", should_continue)

    return graph.compile(checkpointer=checkpointer)
```

## Checkpointer Setup (Production)

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver


async def get_checkpointer(connection_string: str) -> AsyncPostgresSaver:
    checkpointer = AsyncPostgresSaver.from_conn_string(connection_string)
    await checkpointer.setup()
    return checkpointer
```

For local development, use `AsyncSqliteSaver`:

```python
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

checkpointer = AsyncSqliteSaver.from_conn_string("checkpoints.db")
```

## Human-in-the-Loop Pattern

```python
from langgraph.types import interrupt


async def approval_node(state: AgentState) -> dict:
    decision = interrupt({
        "question": "Approve this action?",
        "proposed_action": state["planned_action"],
    })
    return {"approved": decision == "yes"}
```

Resume after human input:
```python
graph.invoke(
    None,
    config={"configurable": {"thread_id": thread_id}},
    command={"resume": "yes"},
)
```

## Claude Adapter for LangGraph

```python
from anthropic import AsyncAnthropic

from src.project_name.core.config import settings


class ClaudeAdapter:
    def __init__(self) -> None:
        self._client = AsyncAnthropic()

    async def invoke(
        self,
        system: str,
        messages: list[dict],
        context: list[str] | None = None,
    ) -> str:
        system_prompt = system
        if context:
            system_prompt += f"\n\nContext:\n" + "\n".join(context)

        response = await self._client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        )
        return response.content[0].text
```

## Tool Definition Pattern

```python
from langchain_core.tools import tool


@tool
async def search_knowledge_base(query: str) -> str:
    """Search the knowledge base for relevant documents.

    Args:
        query: The search query in natural language.

    Returns:
        Relevant document excerpts as a single string.
    """
    results = await kb_adapter.search(query, top_k=5)
    return "\n\n".join(r.text for r in results)
```

## FastAPI Integration

```python
from fastapi import APIRouter
from langgraph.types import Command

router = APIRouter()
_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph(checkpointer=get_checkpointer(...))
    return _graph


@router.post("/chat")
async def chat(request: ChatRequest) -> ChatResponse:
    graph = get_graph()
    config = {"configurable": {"thread_id": request.thread_id}}
    result = await graph.ainvoke(
        {"user_input": request.message, "messages": []},
        config=config,
    )
    return ChatResponse(answer=result["final_answer"])
```

## Further Resources

- `resources/streaming.md` — SSE streaming responses from LangGraph
- `resources/multi-agent.md` — supervisor pattern for multi-agent coordination
- `resources/testing-agents.md` — testing LangGraph graphs with pytest
