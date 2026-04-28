# Multi-Agent Coordination in LangGraph

## Supervisor Pattern

Супервизор — это агент, который маршрутизирует задачи между специализированными подагентами. Это наиболее предсказуемая и дебаггируемая мультиагентная архитектура.

```python
from typing import Literal
from langgraph.graph import END, StateGraph
from src.project_name.agents.state import AgentState


AGENTS = ["researcher", "analyst", "writer"]


async def supervisor_node(state: AgentState) -> dict:
    system = f"""You are a supervisor coordinating these agents: {AGENTS}.
    Given the current task and history, decide which agent should act next.
    Return JSON: {{"next": "<agent_name_or_FINISH>"}}"""

    response = await claude_adapter.invoke(
        system=system,
        messages=state["messages"],
    )

    import json
    decision = json.loads(response)
    return {"next_agent": decision["next"]}


def route_to_agent(state: AgentState) -> str:
    next_agent = state.get("next_agent", "FINISH")
    if next_agent == "FINISH":
        return END
    return next_agent


def build_multi_agent_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("supervisor", supervisor_node)
    graph.add_node("researcher", researcher_node)
    graph.add_node("analyst", analyst_node)
    graph.add_node("writer", writer_node)

    graph.set_entry_point("supervisor")

    graph.add_conditional_edges("supervisor", route_to_agent)

    for agent in AGENTS:
        graph.add_edge(agent, "supervisor")

    return graph.compile()
```

## Parallel Subgraph Pattern

Для независимых задач, которые можно выполнять параллельно:

```python
from langgraph.graph import StateGraph, Send


async def fan_out_node(state: AgentState) -> list[Send]:
    tasks = state["subtasks"]
    return [Send("worker", {"task": task}) for task in tasks]


async def fan_in_node(state: AgentState) -> dict:
    results = state["subtask_results"]
    combined = "\n\n".join(results)
    return {"combined_result": combined}


graph.add_node("fan_out", fan_out_node)
graph.add_node("worker", worker_node)
graph.add_node("fan_in", fan_in_node)

graph.add_conditional_edges("fan_out", lambda s: s)
graph.add_edge("worker", "fan_in")
```

## State Design for Multi-Agent

```python
from typing import Annotated
import operator
from typing_extensions import TypedDict


class MultiAgentState(TypedDict):
    messages: Annotated[list[dict], operator.add]
    task: str
    next_agent: str
    subtasks: list[str]
    subtask_results: Annotated[list[str], operator.add]
    final_result: str | None
    iteration_count: int
    max_iterations: int
```

Всегда включай `max_iterations` и проверку в supervisor — иначе агент может зациклиться.

## Debugging Multi-Agent Graphs

```python
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()
graph = build_multi_agent_graph().compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "debug-001"}}

async for event in graph.astream_events(initial_state, config=config, version="v2"):
    kind = event["event"]
    if kind == "on_chain_start":
        print(f"Starting node: {event['name']}")
    elif kind == "on_chain_end":
        print(f"Finished node: {event['name']} → {event['data'].get('output', {})}")
```
