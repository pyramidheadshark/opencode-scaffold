# RAG Evaluation with RAGAS

## Core Metrics

RAGAS оценивает RAG-систему по четырём измерениям без необходимости иметь ground truth ответы (кроме `context_recall`):

| Metric | Что измеряет | Нужен ground truth? |
|---|---|---|
| `faithfulness` | Ответ основан только на контексте? | Нет |
| `answer_relevancy` | Ответ релевантен вопросу? | Нет |
| `context_precision` | Полезны ли retrieved чанки? | Нет |
| `context_recall` | Нашли ли мы нужные чанки? | Да |

## Installation

```bash
uv add ragas datasets
```

## Evaluation Pipeline

```python
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision


async def build_eval_dataset(rag_service, questions: list[str]) -> Dataset:
    rows = []
    for question in questions:
        result = await rag_service.answer(question)
        rows.append({
            "question": question,
            "answer": result["answer"],
            "contexts": [r["text"] for r in result["retrieved"]],
        })
    return Dataset.from_list(rows)


def run_ragas_eval(dataset: Dataset) -> dict:
    result = evaluate(
        dataset,
        metrics=[faithfulness, answer_relevancy, context_precision],
    )
    return result.to_pandas().mean().to_dict()
```

## Minimal Eval Set

Минимальный набор для первичной оценки — 20 вопросов, покрывающих:
- Прямые вопросы с очевидным ответом в документах (должны давать faithfulness > 0.9)
- Вопросы на синтез из нескольких источников
- Вопросы, ответа на которые нет в базе (система должна признать незнание)
- Вопросы с цифрами и конкретными фактами

Целевые значения для продакшена: `faithfulness > 0.85`, `answer_relevancy > 0.80`.

## Logging Eval Results to MLflow

```python
import mlflow

with mlflow.start_run(run_name="rag_eval"):
    scores = run_ragas_eval(dataset)
    for metric, value in scores.items():
        mlflow.log_metric(metric, value)
    mlflow.log_param("top_k", 5)
    mlflow.log_param("chunk_size", 512)
    mlflow.log_param("embedding_model", "multilingual-e5-base")
```
