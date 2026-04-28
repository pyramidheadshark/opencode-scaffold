# Feature Store Patterns

## Philosophy

Полноценный feature store (Feast, Hopsworks) избыточен для большинства наших проектов. Вместо него используем **structured feature cache** — простой, воспроизводимый, без внешних зависимостей.

Переходи к Feast только если: несколько команд совместно используют фичи, нужен point-in-time correct join для временных рядов, фичи пересчитываются в реальном времени для serving.

## Structured Feature Cache

```
data/
├── raw/               # исходные данные, неизменяемые
├── interim/           # промежуточные трансформации
├── processed/
│   ├── features_v1.2.parquet   # финальная feature matrix
│   └── features_v1.2_meta.json # схема, статистики, хэш raw данных
└── manifest.json
```

```python
import hashlib
import json
from pathlib import Path
from datetime import datetime

import pandas as pd


class FeatureCache:
    def __init__(self, cache_dir: Path) -> None:
        self._dir = cache_dir
        self._dir.mkdir(parents=True, exist_ok=True)

    def _raw_hash(self, raw_path: Path) -> str:
        h = hashlib.sha256()
        h.update(raw_path.read_bytes())
        return h.hexdigest()[:12]

    def key(self, raw_path: Path, version: str) -> str:
        return f"features_{version}_{self._raw_hash(raw_path)}"

    def exists(self, cache_key: str) -> bool:
        return (self._dir / f"{cache_key}.parquet").exists()

    def load(self, cache_key: str) -> pd.DataFrame:
        path = self._dir / f"{cache_key}.parquet"
        return pd.read_parquet(path)

    def save(self, df: pd.DataFrame, cache_key: str, meta: dict) -> None:
        df.to_parquet(self._dir / f"{cache_key}.parquet", index=False)
        meta["created_at"] = datetime.utcnow().isoformat()
        meta["rows"] = len(df)
        meta["columns"] = list(df.columns)
        (self._dir / f"{cache_key}_meta.json").write_text(
            json.dumps(meta, indent=2, ensure_ascii=False)
        )
```

## Usage Pattern

```python
from src.project_name.ml.features.builder import build_features

cache = FeatureCache(Path("data/processed"))
raw_path = Path("data/raw/dataset.parquet")
cache_key = cache.key(raw_path, version="1.2")

if cache.exists(cache_key):
    features = cache.load(cache_key)
else:
    raw = pd.read_parquet(raw_path)
    features = build_features(raw)
    cache.save(features, cache_key, meta={"pipeline_version": "1.2", "source": str(raw_path)})
```

## Feature Builder Pattern

```python
import pandas as pd
from src.project_name.ml.features.transformers import DateFeatureExtractor, LagFeatureAdder


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = DateFeatureExtractor("created_at").fit_transform(df)
    df = LagFeatureAdder("target", lags=[1, 7, 30]).fit_transform(df)
    df = df.dropna()
    return df
```

## Feature Statistics для мониторинга

```python
import pandas as pd


def compute_feature_stats(df: pd.DataFrame) -> dict:
    stats = {}
    for col in df.select_dtypes(include="number").columns:
        stats[col] = {
            "mean": float(df[col].mean()),
            "std": float(df[col].std()),
            "min": float(df[col].min()),
            "max": float(df[col].max()),
            "null_pct": float(df[col].isna().mean()),
        }
    return stats


def detect_drift(train_stats: dict, serve_stats: dict, threshold: float = 0.3) -> list[str]:
    drifted = []
    for col in train_stats:
        if col not in serve_stats:
            continue
        train_mean = train_stats[col]["mean"]
        serve_mean = serve_stats[col]["mean"]
        train_std = train_stats[col]["std"]
        if train_std > 0 and abs(serve_mean - train_mean) / train_std > threshold:
            drifted.append(col)
    return drifted
```

Сохраняй `train_stats` в MLflow при обучении:
```python
import mlflow
import json

mlflow.log_dict(compute_feature_stats(X_train), "feature_stats.json")
```
