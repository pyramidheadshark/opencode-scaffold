# ML Data Handling

## When to Load This Skill

Load when working with: pickle, ONNX, Parquet, Feather, HDF5, large datasets, S3/Object Storage, DVC-like versioning, model artifacts, data pipelines.

## Core Principle

Binary ML artifacts (weights, embeddings, datasets) are NEVER committed to Git.
They live in object storage (Yandex Cloud Object Storage — S3-compatible) or are reproducible via pipeline.
Paths and versions are tracked in code; actual data is not.

## Directory Convention

```
project-name/
├── data/
│   ├── raw/          # gitignored — original client data, immutable
│   ├── interim/      # gitignored — intermediate transformations
│   ├── processed/    # gitignored — final features ready for training
│   └── .gitkeep      # committed — preserves structure
├── models/
│   ├── weights/      # gitignored — .pt, .onnx, .safetensors
│   └── .gitkeep
└── artifacts/        # gitignored — experiment outputs
```

## Data Versioning Strategy

We do not use DVC (adds friction). Instead: **manifest files** committed to Git.

Each data version has a corresponding `data/manifest.json`:

```json
{
  "version": "1.2.0",
  "created_at": "2026-03-01T10:00:00Z",
  "splits": {
    "train": {
      "path": "s3://bucket/datasets/project/v1.2.0/train.parquet",
      "rows": 45000,
      "sha256": "a3f2..."
    },
    "val": {
      "path": "s3://bucket/datasets/project/v1.2.0/val.parquet",
      "rows": 5000,
      "sha256": "b7c1..."
    }
  },
  "preprocessing": {
    "script": "scripts/preprocess.py",
    "commit": "abc123"
  }
}
```

## S3 / Yandex Cloud Object Storage Adapter

```python
import boto3
from botocore.config import Config

from src.project_name.core.config import settings


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url="https://storage.yandexcloud.net",
        aws_access_key_id=settings.yc_access_key_id,
        aws_secret_access_key=settings.yc_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="ru-central1",
    )


async def download_artifact(s3_key: str, local_path: str) -> None:
    client = get_s3_client()
    client.download_file(settings.yc_bucket_name, s3_key, local_path)


async def upload_artifact(local_path: str, s3_key: str) -> None:
    client = get_s3_client()
    client.upload_file(local_path, settings.yc_bucket_name, s3_key)
```

Required `.env` keys:
```
YC_ACCESS_KEY_ID=...
YC_SECRET_ACCESS_KEY=...
YC_BUCKET_NAME=...
```

## Pickle Safety Rules

Pickle is executable — loading untrusted pickles is a security vulnerability.

```python
import pickle
from pathlib import Path


def safe_load_pickle(path: Path, allowed_classes: set[type]) -> object:
    class RestrictedUnpickler(pickle.Unpickler):
        def find_class(self, module: str, name: str) -> type:
            for cls in allowed_classes:
                if cls.__module__ == module and cls.__name__ == name:
                    return cls
            raise pickle.UnpicklingError(f"Forbidden class: {module}.{name}")

    with path.open("rb") as f:
        return RestrictedUnpickler(f).load()
```

For model artifacts, prefer **ONNX** over pickle whenever possible.

## ONNX Export Pattern

```python
import torch
import torch.onnx
from pathlib import Path


def export_to_onnx(
    model: torch.nn.Module,
    dummy_input: torch.Tensor,
    output_path: Path,
    input_names: list[str],
    output_names: list[str],
    dynamic_axes: dict | None = None,
) -> None:
    model.eval()
    torch.onnx.export(
        model,
        dummy_input,
        str(output_path),
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=input_names,
        output_names=output_names,
        dynamic_axes=dynamic_axes or {},
    )
```

## ONNX Inference Pattern

```python
import numpy as np
import onnxruntime as ort
from pathlib import Path


class OnnxInferenceAdapter:
    def __init__(self, model_path: Path) -> None:
        self._session = ort.InferenceSession(
            str(model_path),
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        self._input_name = self._session.get_inputs()[0].name

    def predict(self, inputs: np.ndarray) -> np.ndarray:
        outputs = self._session.run(None, {self._input_name: inputs})
        return outputs[0]
```

## Parquet / Large Tabular Data

```python
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq


def read_large_parquet(path: str, columns: list[str] | None = None) -> pd.DataFrame:
    return pd.read_parquet(path, columns=columns, engine="pyarrow")


def write_parquet(df: pd.DataFrame, path: str) -> None:
    table = pa.Table.from_pandas(df)
    pq.write_table(table, path, compression="snappy")
```

For very large files (>1GB), use chunked reading:

```python
import pyarrow.parquet as pq


def iter_parquet_chunks(path: str, batch_size: int = 10_000):
    pf = pq.ParquetFile(path)
    for batch in pf.iter_batches(batch_size=batch_size):
        yield batch.to_pandas()
```

## Archived Dataset Splits (Multi-Part)

Client often sends data as split archives (`dataset.zip.001`, `.002`, ...). Reassemble before processing:

```bash
cat dataset.zip.* > dataset.zip
unzip dataset.zip -d data/raw/
```

Then verify integrity and log in `data/manifest.json`.

## Further Resources

- `resources/dvc-alternative.md` — why we use manifest files instead of DVC
- `resources/feature-store.md` — feature caching patterns for repeated experiments
