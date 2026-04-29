# Prompt Engineering

## When to Load This Skill

Load when working with: system prompts, few-shot examples, chain-of-thought, prompt templates, `system_prompt`, `few_shot`, prompt evaluation, "промпт", CoT, output formatting, structured output.

## System Prompt Structure

A production system prompt has four sections:

```
## Role
Who Claude is in this context.

## Context
What the system is, what data Claude has access to, key constraints.

## Task
What Claude must do. Be specific — avoid "help the user".

## Output Format
Exact format of the response. Include examples.
```

Keep system prompts under 2000 tokens. Longer prompts reduce Claude's effective context for user content.

## Few-Shot Examples

Place examples AFTER the main instruction, not before. Three examples outperform one. Use diverse examples that cover edge cases.

```python
SYSTEM_PROMPT = """
You are a document classifier. Classify the document into one of: invoice, contract, receipt, other.

Examples:
Document: "Payment due by 30 days for services rendered..."
Label: invoice

Document: "This agreement is made between Party A and Party B..."
Label: contract

Document: "Thank you for your purchase. Total: $42.00"
Label: receipt
"""
```

## Chain-of-Thought

Use explicit CoT for reasoning tasks. Add "Think step by step" or "First reason through the problem, then give your answer."

```python
SYSTEM_PROMPT = """
You are a data analyst. When answering questions about data:
1. First, identify what the question is asking
2. List the relevant data points
3. Reason through the calculation
4. State your final answer

Do not skip directly to the answer.
"""
```

Do NOT use CoT for classification or extraction tasks — it wastes tokens without improving accuracy.

## Structured Output

For JSON output, provide the exact schema in the system prompt:

```python
SYSTEM_PROMPT = """
Extract the following fields from the document. Return ONLY valid JSON, no other text:

{
  "date": "YYYY-MM-DD or null",
  "amount": float or null,
  "vendor": "string or null",
  "category": "invoice|receipt|contract|other"
}
"""
```

Validate the output with Pydantic:

```python
from pydantic import BaseModel

class DocumentExtraction(BaseModel):
    date: str | None
    amount: float | None
    vendor: str | None
    category: str

def extract(text: str) -> DocumentExtraction:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=EXTRACTION_PROMPT,
        messages=[{"role": "user", "content": text}],
    )
    return DocumentExtraction.model_validate_json(response.content[0].text)
```

## Prompt Versioning

Store prompts in files, not inline strings:

```
prompts/
├── v1/
│   ├── system.md
│   └── examples.md
└── v2/
    ├── system.md
    └── examples.md
```

Load at startup, cache in memory:

```python
from pathlib import Path
from functools import lru_cache

@lru_cache(maxsize=None)
def load_prompt(name: str, version: str = "v1") -> str:
    path = Path("prompts") / version / f"{name}.md"
    return path.read_text(encoding="utf-8")
```

## Common Failure Modes

- **Instruction following failure**: too many rules in one prompt → split into sub-tasks
- **Format drift**: Claude adds explanation around JSON → add "Return ONLY..." + validate
- **Role confusion**: Claude breaks character → strengthen the Role section
- **Reasoning shortcut**: Claude skips steps → explicitly require intermediate steps

## See Also

- `resources/structured-output.md` — advanced output validation patterns
- `resources/evals-framework.md` — eval framework for prompt regression testing
