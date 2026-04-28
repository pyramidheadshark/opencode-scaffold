# Hyperparameter Tuning with Optuna

## Standard HPO Pattern

```python
import optuna
import mlflow
from sklearn.model_selection import cross_val_score
import numpy as np


def objective(trial: optuna.Trial, X_train, y_train) -> float:
    params = {
        "n_estimators": trial.suggest_int("n_estimators", 50, 500),
        "max_depth": trial.suggest_int("max_depth", 3, 10),
        "learning_rate": trial.suggest_float("learning_rate", 1e-3, 0.3, log=True),
        "subsample": trial.suggest_float("subsample", 0.6, 1.0),
        "min_samples_leaf": trial.suggest_int("min_samples_leaf", 1, 20),
    }

    from sklearn.ensemble import GradientBoostingClassifier
    model = GradientBoostingClassifier(**params, random_state=42)
    scores = cross_val_score(model, X_train, y_train, cv=3, scoring="f1_weighted", n_jobs=-1)
    return float(np.mean(scores))


def run_hpo(X_train, y_train, n_trials: int = 50) -> dict:
    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=42))
    study.optimize(lambda trial: objective(trial, X_train, y_train), n_trials=n_trials)

    best_params = study.best_params
    best_value = study.best_value

    with mlflow.start_run(run_name="hpo_best"):
        mlflow.log_params(best_params)
        mlflow.log_metric("best_cv_f1", best_value)

    return best_params
```

## Optuna + MLflow Integration

```python
import optuna.integration.mlflow

mlflow.set_experiment("hpo_experiment")

with mlflow.start_run():
    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=50, callbacks=[optuna.integration.mlflow.MLflowCallback()])
```
