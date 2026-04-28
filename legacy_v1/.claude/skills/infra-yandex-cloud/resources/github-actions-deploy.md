# GitHub Actions Deploy Workflow for Yandex Cloud

```yaml
name: Deploy

on:
  push:
    tags:
      - "v*.*.*"
  workflow_dispatch:
    inputs:
      environment:
        description: "Target environment"
        required: true
        default: "staging"
        type: choice
        options: [staging, production]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment || 'staging' }}

    steps:
      - uses: actions/checkout@v4

      - name: Install Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.7.x"

      - name: Configure AWS CLI for YC Object Storage
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.YC_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.YC_SECRET_ACCESS_KEY }}
          aws-region: ru-central1

      - name: Terraform Init
        working-directory: infra/terraform
        env:
          AWS_ENDPOINT_URL_S3: https://storage.yandexcloud.net
        run: terraform init

      - name: Terraform Plan
        working-directory: infra/terraform
        env:
          TF_VAR_yc_token: ${{ secrets.YC_TOKEN }}
          TF_VAR_yc_cloud_id: ${{ secrets.YC_CLOUD_ID }}
          TF_VAR_yc_folder_id: ${{ secrets.YC_FOLDER_ID }}
          TF_VAR_image_tag: ${{ github.ref_name }}
        run: terraform plan -out=tfplan

      - name: Terraform Apply
        working-directory: infra/terraform
        run: terraform apply -auto-approve tfplan
```
