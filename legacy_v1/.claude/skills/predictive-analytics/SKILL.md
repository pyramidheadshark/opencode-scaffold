# Predictive Analytics

## When to Load This Skill

Load when working with: scikit-learn pipelines, feature engineering, tabular ML, time series, model training/evaluation, MLflow experiment tracking, model registry, cross-validation.

## Project Structure for ML Projects

```
src/{project_name}/
├── core/
│   └── domain.py
├── ml/
│   ├── __init__.py
│   ├── features/
│   │   ├── __init__.py
│   │   ├── builder.py       # FeatureBuilder — assembles feature matrix
│   │   └── transformers.py  # custom sklearn transformers
│   ├── models/
│   │   ├── __init__.py
│   │   ├── trainer.py       # training pipeline
│   │   └── evaluator.py     # metrics computation
│   └── registry/
│       └── mlflow_adapter.py
```

## Sklearn Pipeline Standard

Always use `Pipeline` — never apply transformations outside of it. This ensures train/test consistency and prevents data leakage.

```python
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def build_pipeline(
    numeric_features: list[str],
    categorical_features: list[str],
) -> Pipeline:
    numeric_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    categorical_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    preprocessor = ColumnTransformer([
        ("num", numeric_transformer, numeric_features),
        ("cat", categorical_transformer, categorical_features),
    ])

    return Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", GradientBoostingClassifier(n_estimators=200, random_state=42)),
    ])
```

## Custom Transformer Pattern

```python
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin


class DateFeatureExtractor(BaseEstimator, TransformerMixin):
    def __init__(self, date_column: str) -> None:
        self.date_column = date_column

    def fit(self, X: pd.DataFrame, y=None) -> "DateFeatureExtractor":
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        X = X.copy()
        dt = pd.to_datetime(X[self.date_column])
        X[f"{self.date_column}_year"] = dt.dt.year
        X[f"{self.date_column}_month"] = dt.dt.month
        X[f"{self.date_column}_dayofweek"] = dt.dt.dayofweek
        X[f"{self.date_column}_quarter"] = dt.dt.quarter
        return X.drop(columns=[self.date_column])
```

## MLflow Experiment Tracking

```python
import mlflow
import mlflow.sklearn
from sklearn.metrics import classification_report
from sklearn.model_selection import cross_val_score
import numpy as np
import pandas as pd


class ExperimentTracker:
    def __init__(self, experiment_name: str, tracking_uri: str = "mlruns") -> None:
        mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment(experiment_name)

    def run(
        self,
        pipeline,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        params: dict,
        run_name: str = "",
    ) -> str:
        with mlflow.start_run(run_name=run_name) as run:
            mlflow.log_params(params)

            cv_scores = cross_val_score(pipeline, X_train, y_train, cv=5, scoring="f1_weighted")
            mlflow.log_metric("cv_f1_mean", float(np.mean(cv_scores)))
            mlflow.log_metric("cv_f1_std", float(np.std(cv_scores)))

            pipeline.fit(X_train, y_train)
            y_pred = pipeline.predict(X_test)
            report = classification_report(y_test, y_pred, output_dict=True)

            mlflow.log_metric("test_f1", report["weighted avg"]["f1-score"])
            mlflow.log_metric("test_precision", report["weighted avg"]["precision"])
            mlflow.log_metric("test_recall", report["weighted avg"]["recall"])

            mlflow.sklearn.log_model(pipeline, "model")

            return run.info.run_id
```

## Model Registry and Promotion

```python
import mlflow
from mlflow.tracking import MlflowClient


class ModelRegistryAdapter:
    def __init__(self, model_name: str) -> None:
        self._client = MlflowClient()
        self._model_name = model_name

    def register(self, run_id: str) -> int:
        result = mlflow.register_model(
            model_uri=f"runs:/{run_id}/model",
            name=self._model_name,
        )
        return result.version

    def promote_to_production(self, version: int) -> None:
        self._client.transition_model_version_stage(
            name=self._model_name,
            version=str(version),
            stage="Production",
            archive_existing_versions=True,
        )

    def load_production(self):
        return mlflow.sklearn.load_model(
            model_uri=f"models:/{self._model_name}/Production"
        )
```

## Evaluation Standard

Always report these metrics for classification. Never report accuracy alone.

```python
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    average_precision_score,
)
import pandas as pd


def evaluate_classifier(y_true, y_pred, y_prob=None) -> dict:
    report = classification_report(y_true, y_pred, output_dict=True)
    metrics = {
        "f1_weighted": report["weighted avg"]["f1-score"],
        "precision_weighted": report["weighted avg"]["precision"],
        "recall_weighted": report["weighted avg"]["recall"],
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
    }
    if y_prob is not None:
        metrics["roc_auc"] = roc_auc_score(y_true, y_prob, multi_class="ovr")
        metrics["avg_precision"] = average_precision_score(y_true, y_prob)
    return metrics
```

## Time Series Specifics

For time series data, use `TimeSeriesSplit` — never `train_test_split` with shuffling.

```python
from sklearn.model_selection import TimeSeriesSplit, cross_val_score

tscv = TimeSeriesSplit(n_splits=5, gap=7)
scores = cross_val_score(pipeline, X, y, cv=tscv, scoring="neg_mean_absolute_error")
```

Feature engineering for time series:
```python
def add_lag_features(df: pd.DataFrame, target_col: str, lags: list[int]) -> pd.DataFrame:
    df = df.copy()
    for lag in lags:
        df[f"{target_col}_lag_{lag}"] = df[target_col].shift(lag)
    return df


def add_rolling_features(df: pd.DataFrame, target_col: str, windows: list[int]) -> pd.DataFrame:
    df = df.copy()
    for w in windows:
        df[f"{target_col}_roll_mean_{w}"] = df[target_col].rolling(w).mean()
        df[f"{target_col}_roll_std_{w}"] = df[target_col].rolling(w).std()
    return df
```

## Required Dependencies

```toml
dependencies = [
    "scikit-learn>=1.4.0",
    "pandas>=2.2.0",
    "numpy>=1.26.0",
    "mlflow>=2.12.0",
    "optuna>=3.6.0",     # hyperparameter optimization
]
```

## Further Resources

- `resources/hyperparameter-tuning.md` — Optuna integration for HPO
- `resources/feature-importance.md` — SHAP values and feature selection
