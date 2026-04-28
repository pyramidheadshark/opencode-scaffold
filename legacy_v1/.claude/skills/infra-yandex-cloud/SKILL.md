# Infra: Yandex Cloud

## When to Load This Skill

Load when working with: Terraform, Packer, Yandex Cloud resources, Docker deployment to VMs, Kubernetes prep, CI/CD deploy steps, VM configuration.

## Stack

- **Packer** — builds VM images (pre-baked with Docker, dependencies)
- **Terraform** — provisions YC infrastructure (VMs, networking, Object Storage)
- **Docker Compose** — runs application on provisioned VM
- **Helm** — Kubernetes-ready charts prepared from day one (even if K8s not yet used)

## Repository Structure

```
infra/
├── packer/
│   ├── ubuntu-base.pkr.hcl     # base image with Docker + system deps
│   └── variables.pkr.hcl
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── versions.tf
│   └── modules/
│       ├── vm/                  # reusable VM module
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       └── networking/
│           ├── main.tf
│           ├── variables.tf
│           └── outputs.tf
└── helm/                        # K8s-ready, deploy when needed
    └── {project-name}/
        ├── Chart.yaml
        ├── values.yaml
        └── templates/
            ├── deployment.yaml
            ├── service.yaml
            └── configmap.yaml
```

## Terraform: versions.tf Standard

```hcl
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = "~> 0.115"
    }
  }

  backend "s3" {
    endpoints = {
      s3 = "https://storage.yandexcloud.net"
    }
    bucket = "tf-state-bucket"
    region = "ru-central1"
    key    = "{project-name}/terraform.tfstate"

    skip_region_validation      = true
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
  }
}

provider "yandex" {
  token     = var.yc_token
  cloud_id  = var.yc_cloud_id
  folder_id = var.yc_folder_id
  zone      = var.yc_zone
}
```

## Terraform: VM Module (CPU)

```hcl
resource "yandex_compute_instance" "app" {
  name        = "${var.project_name}-${var.environment}"
  platform_id = "standard-v3"
  zone        = var.zone

  resources {
    cores         = var.cpu_cores
    memory        = var.memory_gb
    core_fraction = 100
  }

  boot_disk {
    initialize_params {
      image_id = var.image_id
      size     = var.disk_gb
      type     = "network-ssd"
    }
  }

  network_interface {
    subnet_id = var.subnet_id
    nat       = true
  }

  metadata = {
    ssh-keys  = "ubuntu:${file(var.ssh_public_key_path)}"
    user-data = templatefile("${path.module}/cloud-init.yaml", {
      docker_compose_content = base64encode(file(var.docker_compose_path))
      env_content            = base64encode(file(var.env_file_path))
    })
  }
}
```

## Terraform: GPU VM Module

```hcl
resource "yandex_compute_instance" "gpu" {
  name        = "${var.project_name}-gpu-${var.environment}"
  platform_id = "gpu-standard-v3"
  zone        = "ru-central1-a"

  resources {
    cores  = 8
    memory = 96
    gpus   = 1
  }

  boot_disk {
    initialize_params {
      image_id = var.gpu_image_id
      size     = 200
      type     = "network-ssd"
    }
  }

  network_interface {
    subnet_id = var.subnet_id
    nat       = true
  }
}
```

## Packer: Base Ubuntu Image

```hcl
packer {
  required_plugins {
    yandex = {
      version = ">= 1.1.2"
      source  = "github.com/hashicorp/yandex"
    }
  }
}

source "yandex" "ubuntu-base" {
  token              = var.yc_token
  folder_id          = var.yc_folder_id
  source_image_family = "ubuntu-2204-lts"
  ssh_username       = "ubuntu"
  image_name         = "ml-base-${formatdate("YYYYMMDD-HHmm", timestamp())}"
  image_family       = "ml-base"
  zone               = "ru-central1-a"
}

build {
  sources = ["source.yandex.ubuntu-base"]

  provisioner "shell" {
    inline = [
      "sudo apt-get update -q",
      "sudo apt-get install -y -q docker.io docker-compose-plugin curl git",
      "sudo systemctl enable docker",
      "sudo usermod -aG docker ubuntu",
      "curl -LsSf https://astral.sh/uv/install.sh | sh",
    ]
  }
}
```

## K8s-Ready: Helm Chart Structure

Even when deploying with Docker Compose, prepare the Helm chart early. It documents what K8s will need and makes the migration trivial.

```yaml
# helm/{project}/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "chart.fullname" . }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ include "chart.name" . }}
  template:
    spec:
      containers:
        - name: app
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          ports:
            - containerPort: 8000
          envFrom:
            - secretRef:
                name: {{ include "chart.fullname" . }}-secrets
          resources:
            requests:
              cpu: {{ .Values.resources.requests.cpu }}
              memory: {{ .Values.resources.requests.memory }}
            limits:
              cpu: {{ .Values.resources.limits.cpu }}
              memory: {{ .Values.resources.limits.memory }}
```

## .tfvars Example (never commit real values)

```hcl
yc_token    = "..."
yc_cloud_id = "b1g..."
yc_folder_id = "b1g..."
yc_zone     = "ru-central1-a"
project_name = "my-project"
environment  = "staging"
cpu_cores    = 2
memory_gb    = 4
disk_gb      = 50
```

## Required .env / GitHub Secrets

```
YC_TOKEN=...
YC_CLOUD_ID=...
YC_FOLDER_ID=...
YC_ZONE=ru-central1-a
TF_STATE_BUCKET=tf-state-bucket
YC_ACCESS_KEY_ID=...        # for S3 backend
YC_SECRET_ACCESS_KEY=...    # for S3 backend
```

## Further Resources

- `resources/cloud-init.md` — cloud-init template for Docker Compose auto-start on VM boot
- `resources/github-actions-deploy.md` — full deploy.yml workflow for YC
