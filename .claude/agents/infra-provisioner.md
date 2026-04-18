---
description: Provisions project infrastructure — writes Terraform, Packer, and Docker Compose configurations from design-doc.md.
model: claude-sonnet-4-6
---

# Agent: infra-provisioner

## Purpose

Provisions project infrastructure based on the design document. Writes Terraform, Packer, and Docker Compose configurations tailored to the project's requirements.

## When to Use

After `design-doc.md` section 8 (Deployment Plan) is filled in. Before Phase 3 (Development Loop) begins.

## Decision Logic

The agent reads the design document and selects the appropriate infrastructure tier:

| Condition | Infrastructure |
|---|---|
| Simple service, < 500 concurrent users | Docker Compose on single YC VM |
| Moderate load, stateless service | Docker Compose + nginx on YC VM |
| High load or K8s explicitly required | Helm chart + YC Managed Kubernetes |
| ML training workload | GPU VM via Terraform |

## Workflow

See "What Gets Created" and "Makefile Standard" sections below for detailed output.

## What Gets Created

### Tier 1: Docker Compose on YC VM

```
infra/
├── packer/
│   ├── ubuntu-base.pkr.hcl
│   └── variables.pkr.hcl
├── terraform/
│   ├── main.tf            # VM + networking
│   ├── variables.tf
│   ├── outputs.tf
│   ├── versions.tf
│   └── cloud-init.yaml
└── Makefile               # convenience commands
```

### Tier 2: K8s-Ready

Same as Tier 1, plus:
```
infra/
└── helm/
    └── {project-name}/
        ├── Chart.yaml
        ├── values.yaml
        ├── values.staging.yaml
        ├── values.production.yaml
        └── templates/
            ├── deployment.yaml
            ├── service.yaml
            ├── ingress.yaml
            └── configmap.yaml
```

## Makefile Standard

```makefile
.PHONY: build plan apply destroy ssh

IMAGE_ID ?= $(shell cat infra/.last_image_id 2>/dev/null)
ENV ?= staging

build:
	cd infra/packer && packer build ubuntu-base.pkr.hcl

plan:
	cd infra/terraform && terraform plan -var-file=$(ENV).tfvars

apply:
	cd infra/terraform && terraform apply -var-file=$(ENV).tfvars

destroy:
	cd infra/terraform && terraform destroy -var-file=$(ENV).tfvars

ssh:
	ssh ubuntu@$(shell cd infra/terraform && terraform output -raw vm_ip)
```

## Instructions for Claude Code

1. Load `infra-yandex-cloud` skill before generating any Terraform/Packer code
2. Always use the module structure from the skill — no monolithic `main.tf`
3. Generate `.tfvars.example` with all required variables listed but no values
4. Add all new YC secret names to the project's `.env.example`
5. Add the deploy GitHub Actions workflow using the template from `infra-yandex-cloud` skill resources
6. After creating infra files, update `dev/status.md` to reflect Phase 2 complete, Phase 3 active
7. Run `terraform validate` and `terraform fmt` before considering the task done
