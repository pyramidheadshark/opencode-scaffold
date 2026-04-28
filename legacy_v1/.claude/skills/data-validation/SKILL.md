# Data Validation

## When to Load This Skill

Load when working with: Pandera DataFrame schemas, Great Expectations suites, data quality checks, input validation for ML pipelines, data contracts between pipeline stages.

## Pandera — DataFrame Schema Validation

Define schemas declaratively and validate at pipeline boundaries:

```python
import pandera as pa
from pandera.typing import DataFrame, Series


class InputSchema(pa.DataFrameModel):
    user_id: Series[int] = pa.Field(ge=0, nullable=False)
    age: Series[float] = pa.Field(ge=0, le=120, nullable=True)
    category: Series[str] = pa.Field(isin=["A", "B", "C"])
    score: Series[float] = pa.Field(ge=0.0, le=1.0)

    class Config:
        strict = True
        coerce = True


@pa.check_types
def preprocess(df: DataFrame[InputSchema]) -> DataFrame[InputSchema]:
    return df.dropna(subset=["user_id"])
```

Validate without decorator:
```python
try:
    InputSchema.validate(df, lazy=True)
except pa.errors.SchemaErrors as e:
    print(e.failure_cases)
```

## Pydantic Data Contracts

Use Pydantic for row-level validation in ingestion endpoints:

```python
from pydantic import BaseModel, Field, field_validator
from typing import Literal


class RecordInput(BaseModel):
    user_id: int = Field(ge=0)
    age: float | None = Field(default=None, ge=0, le=120)
    category: Literal["A", "B", "C"]
    score: float = Field(ge=0.0, le=1.0)

    @field_validator("score")
    @classmethod
    def score_precision(cls, v: float) -> float:
        return round(v, 6)
```

## FastAPI Ingestion Endpoint with Validation

```python
from fastapi import APIRouter, HTTPException
import pandera as pa

router = APIRouter()


@router.post("/ingest")
async def ingest_batch(records: list[RecordInput]) -> dict:
    df = pd.DataFrame([r.model_dump() for r in records])
    try:
        InputSchema.validate(df, lazy=True)
    except pa.errors.SchemaErrors as e:
        raise HTTPException(status_code=422, detail=e.failure_cases.to_dict())
    return {"accepted": len(df)}
```

## ML Pipeline Input/Output Validation

Validate at each stage boundary:

```python
class FeatureSchema(pa.DataFrameModel):
    feature_1: Series[float] = pa.Field(nullable=False)
    feature_2: Series[float] = pa.Field(nullable=False)
    target: Series[int] = pa.Field(isin=[0, 1])

    class Config:
        strict = False


class PredictionSchema(pa.DataFrameModel):
    user_id: Series[int]
    probability: Series[float] = pa.Field(ge=0.0, le=1.0)
    label: Series[int] = pa.Field(isin=[0, 1])
```

## Data Quality Checks (Custom)

For lightweight checks without a full framework:

```python
from dataclasses import dataclass
from typing import Callable
import pandas as pd


@dataclass
class Check:
    name: str
    fn: Callable[[pd.DataFrame], bool]
    error_msg: str


def run_checks(df: pd.DataFrame, checks: list[Check]) -> list[str]:
    failures = []
    for check in checks:
        if not check.fn(df):
            failures.append(f"{check.name}: {check.error_msg}")
    return failures


QUALITY_CHECKS = [
    Check("no_nulls_user_id", lambda df: df["user_id"].notna().all(), "user_id has nulls"),
    Check("score_range", lambda df: df["score"].between(0, 1).all(), "score out of [0,1]"),
    Check("min_rows", lambda df: len(df) >= 10, "batch too small (< 10 rows)"),
]
```

## Known Pitfalls

- Pandera `strict=True` rejects any columns not in the schema — use `strict=False` for pass-through pipelines where extra columns are expected
- `lazy=True` in `validate()` collects ALL failures before raising — use it for batch reporting; without it, validation stops at the first error
- Pydantic `field_validator` runs AFTER type coercion — validate the coerced value, not the raw input string
- Never skip validation in "dev mode" — data quality issues in dev become silent corruptions in production

## Resources

- Pandera docs: https://pandera.readthedocs.io/
- Pydantic validation: https://docs.pydantic.dev/latest/concepts/validators/
