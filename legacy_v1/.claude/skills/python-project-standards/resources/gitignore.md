# .gitignore Standard for ML Engineering Projects

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
dist/
*.egg-info/
.eggs/

# uv
.venv/
uv.lock.bak

# Environment
.env
.env.local
.env.*.local

# Testing & Coverage
.pytest_cache/
.coverage
htmlcov/
.tox/

# MyPy
.mypy_cache/
.dmypy.json

# Ruff
.ruff_cache/

# ML Artifacts — never commit large binary files
*.pkl
*.pickle
*.h5
*.hdf5
*.onnx
*.pt
*.pth
*.bin
*.safetensors
data/raw/
data/processed/
data/interim/
models/weights/
mlruns/
wandb/

# Notebooks output (commit .ipynb but ignore checkpoints)
.ipynb_checkpoints/
*.nbconvert.*

# Docker
.docker/

# Terraform
**/.terraform/
*.tfstate
*.tfstate.backup
*.tfplan
.terraform.lock.hcl
override.tf
override.tf.json

# Packer
packer_cache/

# IDE
.vscode/settings.json
.idea/
*.swp
*.swo
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Temporary
tmp/
temp/
.tmp/
```
