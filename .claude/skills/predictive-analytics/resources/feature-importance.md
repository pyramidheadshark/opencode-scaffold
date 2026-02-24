# Feature Importance with SHAP

## Installation

```bash
uv add shap
```

## Tree-based Models (GBM, XGBoost, LightGBM)

```python
import shap
import pandas as pd
import matplotlib.pyplot as plt


def explain_tree_model(model, X_test: pd.DataFrame, max_display: int = 20) -> dict:
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)

    mean_abs_shap = pd.Series(
        abs(shap_values).mean(axis=0),
        index=X_test.columns,
    ).sort_values(ascending=False)

    shap.summary_plot(shap_values, X_test, max_display=max_display, show=False)
    plt.tight_layout()
    plt.savefig("artifacts/shap_summary.png", dpi=150)
    plt.close()

    return mean_abs_shap.to_dict()
```

## Feature Selection Based on SHAP

```python
def select_features_by_shap(
    model,
    X_train: pd.DataFrame,
    threshold: float = 0.01,
) -> list[str]:
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_train)
    mean_abs = abs(shap_values).mean(axis=0)

    total = mean_abs.sum()
    important = [
        col for col, val in zip(X_train.columns, mean_abs)
        if val / total >= threshold
    ]
    return important
```

## Log SHAP Plot to MLflow

```python
import mlflow

mlflow.log_artifact("artifacts/shap_summary.png", artifact_path="explanations")
```
