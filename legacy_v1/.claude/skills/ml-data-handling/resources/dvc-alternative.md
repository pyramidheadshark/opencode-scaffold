# Why Manifest Files Instead of DVC

DVC is a solid tool, but adds meaningful friction to our workflow:

- Requires a separate remote config per project
- Adds a non-trivial learning curve for new contributors
- `dvc pull` / `dvc push` steps must be remembered in every workflow
- DVC metadata files (`.dvc`) scattered across the repo create confusion

Our manifest approach gives us 80% of the benefit with 20% of the overhead:

- `data/manifest.json` is human-readable and auditable in Git history
- SHA256 checksums provide the same data integrity guarantee
- S3 paths are self-documenting — you can `aws s3 cp` without DVC
- CI/CD downloads artifacts directly via `boto3`, no DVC CLI needed

When to reconsider DVC:
- Team of 5+ engineers all working on data pipelines simultaneously
- Need for fine-grained lineage tracking across many pipeline stages
- Integration with MLflow or other experiment tracking platforms where DVC connectors exist

For solo and small team ML engineering, manifest + S3 is the right default.
