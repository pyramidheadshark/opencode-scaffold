# ML Experiment Audit Protocol

Detailed logic for the [ML] Experiment Auditor role.
Based on: arxiv 2603.15916 (autonomous ML experiment design), project history analysis.

---

## Plateau Detection Algorithm

```
delta_abs = mean(metric[-1], metric[-2], metric[-3]) - metric[-4]
delta_rel = abs(delta_abs) / abs(metric[-4])
if abs(delta_abs) < PLATEAU_ABS_THRESHOLD and delta_rel < PLATEAU_REL_THRESHOLD:
    status = PLATEAU
```

**PLATEAU_ABS_THRESHOLD = 0.01** (1 percentage point absolute change)
**PLATEAU_REL_THRESHOLD = 0.05** (5% relative change from current metric)
**Rule: plateau only if BOTH conditions are met** (conservative — prevents false positives)

Examples:
- metric=0.65, new=0.659 → abs=0.009, rel=1.4% → **PLATEAU** (both below threshold)
- metric=0.65, new=0.670 → abs=0.020, rel=3.1% → **NOT plateau** (abs exceeds 0.01)
- metric=0.90, new=0.895 → abs=0.005, rel=0.6% → **PLATEAU** (high-precision regime)

**Statistical note:** Single-run delta is unreliable due to random seed / data shuffle variance.
Use median of 3 runs before declaring plateau. If only 1 run available — emit WARN, not BLOCK.

When plateau detected:
1. STOP current experiment direction
2. Declare: "Ceiling reached at [metric value]. Last 3 runs: [values]. Delta: [delta]%."
3. PIVOT: propose exactly 2 alternative approaches from different algorithm families

**Pivot suggestion logic:**
- If stuck on distance-based clustering (k-means, DBSCAN) → suggest hashing-based (pHash, dHash) or learned features (autoencoder embeddings)
- If stuck on threshold tuning → suggest learning a threshold from labeled data (logistic regression on scores)
- If stuck on single-model tuning → suggest ensemble or cascaded pipeline
- If stuck on feature engineering → suggest end-to-end learned representation

---

## Hypothesis Quality Checklist

Before approving any experiment:

```
[ ] Hypothesis is specific and falsifiable
    Good: "pHash similarity > 0.95 will correctly cluster 85%+ of defect images"
    Bad:  "pHash might work better"

[ ] Baseline exists (prior result to beat)
    If NO → run baseline FIRST. Block tuning until baseline is established.
    Baseline = simplest reasonable approach (random, threshold=0.5, k=10)

[ ] Success criterion is numeric
    Good: "F1 >= 0.75 on validation set of 500 labeled images"
    Bad:  "better results"

[ ] Failure criterion is defined
    Good: "If F1 < 0.65 after full run → abandon approach"
    Bad:  (not defined — will run indefinitely "hoping" for improvement)

[ ] Alternative hypothesis stated
    "If this fails, the next experiment would be: [X]"
    This prevents dead-end thinking when an experiment fails
```

---

## Observability SLA Requirements

Any experiment with estimated runtime > 30 minutes MUST define:

```yaml
monitoring_plan:
  check_interval: "ETA / 2"          # e.g., 6h run → check at 3h
  hung_detection:
    - cpu_utilization < 5% for 15min → flag as hung
    - no log output for 30min → flag as hung
    - no checkpoint written in last [expected_checkpoint_interval] → flag
  kill_condition:
    - "If ETA exceeded by 20% with no improvement → kill and debug"
  artifact_save:
    - checkpoint: "experiments/{run_id}/checkpoint_{step}.pkl"
    - metrics: "experiments/{run_id}/metrics.json"
    - predictions: "experiments/{run_id}/sample_predictions.csv"
    - manifest: "experiments/manifest.json"  # updated on every run
```

**Mandatory CronCreate before long runs:**
```
CronCreate with interval = ETA/2, command = "check experiment {run_id} status"
```

---

## Macro Priority Validation

Before any experiment, validate that the targeted module is actually a bottleneck.

**Pipeline critical path analysis (required for first experiment in a new session):**
```
1. List all pipeline stages with estimated time share
2. Identify which stage accounts for the most error (not latency — error contribution)
3. Validate: if we fix THIS stage to perfection, how much does overall metric improve?
```

**Bottleneck identification questions:**
- "If clustering were perfect (100% accuracy), what would overall system F1 be?"
- "Is the bottleneck data quality, feature extraction, clustering, or post-processing?"
- "What does a profiling run on 100 samples show as the slowest component?"

**Red flag from project history:**
Clustering metrics were optimized when clustering was NOT the pipeline bottleneck.
Weeks spent on k-means tuning could have been avoided with 30 minutes of pipeline profiling.

---

## Cost / Signal Ratio Decision Framework

For each proposed experiment run:

```
Expected information gain:
  HIGH: first time testing this approach, could be 10-20% improvement
  MEDIUM: incremental variation of proven approach, 2-5% expected
  LOW: minor parameter tweak, < 2% expected, already at plateau

Compute cost:
  HIGH: > 4 hours on GPU/cloud VM
  MEDIUM: 30 min - 4 hours
  LOW: < 30 min, can run locally

Decision matrix:
  HIGH gain + any cost → RUN
  MEDIUM gain + LOW cost → RUN with pilot first
  MEDIUM gain + HIGH cost → REQUIRE PILOT (5%, 5min) before full run
  LOW gain + any cost → BLOCK: "Expected delta < 2%, plateau likely. Pivot instead."
```

---

## Pilot Protocol

Before any full experiment run, always run a pilot:

```
Pilot parameters:
  dataset_fraction: 0.05  # 5% of data
  max_duration: 5 minutes

Pilot validates:
  [ ] Data loading works (no FileNotFoundError, no permission issues)
  [ ] Model training/inference completes without crash
  [ ] Output format is correct (shapes, types, ranges)
  [ ] Metrics can be computed on output
  [ ] Checkpoint saves successfully
  [ ] Estimated full-run duration is reasonable

If pilot fails: debug before scaling. Never scale a broken experiment.
If pilot duration × 20 >> estimated_full_run: re-estimate before committing.
```

---

## Experiment Manifest Format

Every run appends to `experiments/manifest.json`:

```json
{
  "run_id": "H15_kmeans_k500_20260322",
  "hypothesis": "k=500 improves defect cluster purity over k=100",
  "baseline": "H12_kmeans_k100: F1=0.649",
  "target_metric": "F1 >= 0.70",
  "parameters": {"algorithm": "kmeans", "k": 500, "distance": "cosine"},
  "status": "completed",
  "result": {"F1": 0.652, "delta_from_baseline": "+0.3%"},
  "plateau": true,
  "pivot_to": ["pHash similarity", "autoencoder embeddings"],
  "duration_minutes": 340,
  "artifacts": {
    "model": "experiments/H15/kmeans_k500.pkl",
    "metrics": "experiments/H15/metrics.json",
    "predictions": "experiments/H15/sample_predictions.csv"
  }
}
```
