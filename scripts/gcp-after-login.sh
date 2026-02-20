#!/usr/bin/env bash
# 在完成 gcloud auth login 之后运行此脚本，执行 GCP 部署第一步：设置项目并启用 API
# 用法: export GCP_PROJECT_ID=你的项目ID GCP_REGION=us-central1; ./scripts/gcp-after-login.sh

set -e
if [[ -z "$GCP_PROJECT_ID" ]]; then
  echo "请先设置: export GCP_PROJECT_ID=你的项目ID"
  exit 1
fi
GCP_REGION=${GCP_REGION:-us-central1}

echo "设置项目: $GCP_PROJECT_ID"
gcloud config set project "$GCP_PROJECT_ID"

echo "启用所需 API..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  vpcaccess.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

echo "第一步完成。接下来可执行 docs/DEPLOY_GCP_STEPS.md 第二步（VPC 连接器）等。"
echo "或运行: gcloud compute networks vpc-access connectors create study-abroad-connector --region=$GCP_REGION --network=default --range=10.8.0.0/28 --min-instances=2 --max-instances=3"
