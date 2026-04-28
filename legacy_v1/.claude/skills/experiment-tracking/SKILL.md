# Experiment Tracking

## When to Load This Skill

Load when working with: MLflow experiments, run logging, model registry, artifact management, experiment comparison, cross-validation with tracking.

## Core Concepts

| Concept | Purpose |
|---------|---------|
| **Run** | Single training execution — logs params, metrics, artifacts |
| **Experiment** | Named collection of runs — logical grouping by model type or task |
| **Model Registry** | Versioned model store — stages: None → Staging → Production |
| **Artifact** | Any file output — model weights, plots, feature importance |

## Run Lifecycle Pattern

Always use context manager — never log outside a run:

```python
import mlflow
import mlflow.sklearn

mlflow.set_experiment("my-experiment")

with mlflow.start_run(run_name="baseline-rf") as run:
    mlflow.log_params({
        "n_estimators": 100,
        "max_depth": 5,
        "random_state": 42,
    })

    model.fit(X_train, y_train)
    score = model.score(X_val, y_val)

    mlflow.log_metric("val_accuracy", score)
    mlflow.sklearn.log_model(model, "model")

    run_id = run.info.run_id
```

## Autolog Pattern

Use autolog for quick iteration — disable before production for explicit control:

```python
mlflow.sklearn.autolog(
    log_input_examples=True,
    log_model_signatures=True,
    log_models=True,
    silent=True,
)

with mlflow.start_run():
    model.fit(X_train, y_train)
```

## Cross-Validation with MLflow

Log CV results as metrics with step index:

```python
from sklearn.model_selection import cross_val_score
import numpy as np

with mlflow.start_run():
    mlflow.log_params({"cv_folds": 5, "model": "RandomForest"})

    scores = cross_val_score(model, X, y, cv=5, scoring="f1_macro")

    for i, score in enumerate(scores):
        mlflow.log_metric("cv_f1", score, step=i)

    mlflow.log_metric("cv_f1_mean", scores.mean())
    mlflow.log_metric("cv_f1_std", scores.std())
```

## Model Registry

```python
model_uri = f"runs:/{run_id}/model"

registered = mlflow.register_model(model_uri, "my-classifier")

client = mlflow.tracking.MlflowClient()
client.transition_model_version_stage(
    name="my-classifier",
    version=registered.version,
    stage="Staging",
)
```

Loading a registered model:

```python
model = mlflow.sklearn.load_model("models:/my-classifier/Staging")
```

## Experiment Comparison

```python
client = mlflow.tracking.MlflowClient()

runs = client.search_runs(
    experiment_ids=["1"],
    order_by=["metrics.val_f1 DESC"],
    max_results=10,
)

for run in runs:
    print(run.info.run_id, run.data.metrics.get("val_f1"))
```

## Serving via MLflow

```bash
mlflow models serve -m "models:/my-classifier/Production" --port 5001 --no-conda
```

Request format:
```bash
curl -X POST http://localhost:5001/invocations \
  -H "Content-Type: application/json" \
  -d '{"dataframe_records": [{"feature1": 1.0, "feature2": 2.0}]}'
```

## Artifact Logging

```python
with mlflow.start_run():
    fig.savefig("confusion_matrix.png")
    mlflow.log_artifact("confusion_matrix.png", artifact_path="plots")

    mlflow.log_dict(feature_importance_dict, "feature_importance.json")

    mlflow.log_text(classification_report_str, "classification_report.txt")
```

## Project Structure for Tracking

```
src/{project_name}/
├── training/
│   ├── train.py          # entry point — sets experiment, calls fit
│   ├── evaluate.py       # eval loop — logs metrics per epoch/fold
│   └── register.py       # promotes best run to Model Registry
├── mlruns/               # local tracking store (gitignore this)
└── mlflow.db             # local SQLite backend (gitignore this)
```

## Known Pitfalls

- Always use `with mlflow.start_run():` — orphan runs (logged outside context) pollute the experiment registry and are hard to clean up
- Never call `mlflow.end_run()` manually — the context manager handles it; manual calls can corrupt the run state
- Set `MLFLOW_TRACKING_URI` env var in CI — default is `./mlruns` (relative), which breaks across working directories
- `mlflow.autolog()` must be called BEFORE `model.fit()` — calling it after has no effect

## Resources

- MLflow docs: https://mlflow.org/docs/latest/
- Model Registry concepts: https://mlflow.org/docs/latest/model-registry.html
