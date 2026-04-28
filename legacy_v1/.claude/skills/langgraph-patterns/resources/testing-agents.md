# Testing LangGraph Agents

## Strategy

Test nodes as pure async functions — they receive state dict, return state dict.
Test the graph as integration test — use in-memory checkpointer.

## Unit Testing Nodes

```python
import pytest
from src.project_name.agents.nodes.analyst import analyst_node


@pytest.mark.asyncio
async def test_analyst_node_returns_answer_when_context_provided():
    state = {
        "messages": [],
        "user_input": "What is the process for X?",
        "retrieved_context": ["Process X requires steps A, B, C."],
        "final_answer": None,
        "error": None,
        "iteration_count": 0,
    }
    result = await analyst_node(state)
    assert result["final_answer"] is not None
    assert len(result["final_answer"]) > 0


@pytest.mark.asyncio
async def test_analyst_node_handles_empty_context(monkeypatch):
    async def mock_invoke(*args, **kwargs):
        return "I don't have enough context to answer."

    monkeypatch.setattr("src.project_name.adapters.llm.claude_adapter.ClaudeAdapter.invoke", mock_invoke)

    state = {
        "messages": [],
        "user_input": "Unrelated question",
        "retrieved_context": [],
        "final_answer": None,
        "error": None,
        "iteration_count": 0,
    }
    result = await analyst_node(state)
    assert "context" in result["final_answer"].lower()
```

## Integration Testing the Graph

```python
from langgraph.checkpoint.memory import MemorySaver
from src.project_name.agents.graph import build_graph


@pytest.fixture
def graph():
    checkpointer = MemorySaver()
    return build_graph(checkpointer=checkpointer)


@pytest.mark.asyncio
async def test_graph_completes_successfully(graph):
    config = {"configurable": {"thread_id": "test-thread-001"}}
    result = await graph.ainvoke(
        {"user_input": "How do I add a new user?", "messages": []},
        config=config,
    )
    assert result["final_answer"] is not None
    assert result["error"] is None
```
