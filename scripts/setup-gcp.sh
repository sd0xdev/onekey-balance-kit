#!/usr/bin/env bash

# -------------------------------------------------------------
# Google Cloud Workload Identity Federation bootstrap script
# 1. Creates / verifies required APIs, Artifact Registry repo,
#    Service Account, Workload Identity Pool & OIDC Provider
# 2. Binds GitHub Actions repository to the Service Account
# 3. Prints environment variables required by your GitHub repo
# -------------------------------------------------------------

# Exit on first error (comment out for debugging)
#set -euo pipefail

# ---------- Color helpers ----------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ---------- Environment checks ----------
if [[ -z "${PROJECT_ID:-}" ]]; then
  echo -e "${RED}錯誤: 未設置 PROJECT_ID 環境變數${NC}"
  echo -e "${YELLOW}請先執行 source .env.gcp 或 ./scripts/setup-vars.sh${NC}"
  exit 1
fi

if [[ -z "${GITHUB_REPO:-}" ]]; then
  echo -e "${RED}錯誤: 未設置 GITHUB_REPO 環境變數${NC}"
  echo -e "${YELLOW}請先執行 source .env.gcp 或 ./scripts/setup-vars.sh${NC}"
  exit 1
fi

# ---------- Derived variables ----------
REGION="${REGION:-asia-east1}"
REPOSITORY_NAME="${REPOSITORY_NAME:-one-key-balance-kit}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-github-actions-runner}"
SERVICE_ACCOUNT_DISPLAY_NAME="${SERVICE_ACCOUNT_DISPLAY_NAME:-GitHub Actions Runner}"
POOL_ID="${POOL_ID:-github-actions-pool}"
POOL_DISPLAY_NAME="${POOL_DISPLAY_NAME:-GitHub Actions Pool}"
PROVIDER_ID="${PROVIDER_ID:-github-provider}"
PROVIDER_DISPLAY_NAME="${PROVIDER_DISPLAY_NAME:-GitHub Provider}"

# ---------- Project number (必須使用數字做 audience) ----------
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
if [[ -z "$PROJECT_NUMBER" ]]; then
  echo -e "${RED}無法取得 projectNumber，請確認當前身分有 viewer 權限${NC}"
  exit 1
fi

SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Path constants必須使用 projectNumber
WORKLOAD_IDENTITY_POOL_PATH="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}"
PROVIDER_PATH="${WORKLOAD_IDENTITY_POOL_PATH}/providers/${PROVIDER_ID}"

echo -e "${GREEN}設置 Google Cloud 環境，專案: $PROJECT_ID ($PROJECT_NUMBER)，區域: $REGION${NC}"

# ---------- Enable required APIs ----------
echo "啟用必要的 API..."
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  secretmanager.googleapis.com \
  --project "$PROJECT_ID"

# ---------- Artifact Registry ----------
echo "創建 Artifact Registry 儲存庫..."
if gcloud artifacts repositories describe "$REPOSITORY_NAME" --location="$REGION" --project "$PROJECT_ID" &>/dev/null; then
  echo -e "${YELLOW}儲存庫 $REPOSITORY_NAME 已存在${NC}"
else
  gcloud artifacts repositories create "$REPOSITORY_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Docker images for $REPOSITORY_NAME" \
    --project "$PROJECT_ID"
fi

# ---------- Service Account ----------
echo "創建服務帳號..."
if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID" &>/dev/null; then
  echo -e "${YELLOW}服務帳號 $SERVICE_ACCOUNT_EMAIL 已存在${NC}"
else
  gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
    --display-name="$SERVICE_ACCOUNT_DISPLAY_NAME" \
    --project "$PROJECT_ID"
fi

# ---------- Grant roles to Service Account ----------
echo "授予服務帳號權限..."
roles=(
  roles/artifactregistry.writer
  roles/run.admin
  roles/iam.serviceAccountUser
  roles/secretmanager.secretAccessor
)
for r in "${roles[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="$r" --condition=None 2>/dev/null || true
done

echo -e "${GREEN}權限已授予${NC}"

# ---------- Workload Identity Pool ----------
if gcloud iam workload-identity-pools describe "$POOL_ID" --location=global --project "$PROJECT_ID" &>/dev/null; then
  echo -e "${YELLOW}工作負載身份池 $POOL_ID 已存在${NC}"
else
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --location=global \
    --display-name="$POOL_DISPLAY_NAME" \
    --project "$PROJECT_ID"
fi

# ---------- OIDC Provider ----------
if gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
     --workload-identity-pool="$POOL_ID" --location=global --project "$PROJECT_ID" &>/dev/null; then
  echo -e "${YELLOW}工作負載身份提供者 $PROVIDER_ID 已存在，跳過創建${NC}"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --workload-identity-pool="$POOL_ID" \
    --location=global \
    --display-name="$PROVIDER_DISPLAY_NAME" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='${GITHUB_REPO}'" \
    --project "$PROJECT_ID"
fi

echo -e "${GREEN}工作負載身份提供者 $PROVIDER_ID 準備完成${NC}"

# ---------- Bind GitHub repo to Service Account ----------

echo "綁定 GitHub 存儲庫 ${GITHUB_REPO} 到服務帳號..."
BINDING_MEMBER="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_PATH}/attribute.repository/${GITHUB_REPO}"

gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="$BINDING_MEMBER" \
  --project "$PROJECT_ID" 2>/dev/null || true

echo -e "${GREEN}Service Account 綁定完成${NC}"

gcloud iam service-accounts get-iam-policy "$SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID" | grep -A 5 workloadIdentityUser || true

# ---------- Grant Secret access to Cloud Run runtime SA ----------
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "授權 Cloud Run runtime SA 存取 SecretManager..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${RUNTIME_SA}" --role="roles/secretmanager.secretAccessor" --condition=None 2>/dev/null || true

# ---------- Output for GitHub Secrets ----------
WORKLOAD_IDENTITY_PROVIDER="${PROVIDER_PATH}"

echo -e "\n${GREEN}=== 設置完成，請在 GitHub Secret / Variables 使用以下值 ===${NC}"
echo -e "GCP_PROJECT_ID      = $PROJECT_ID"
echo -e "GCP_PROJECT_NUMBER  = $PROJECT_NUMBER"
echo -e "GCP_SERVICE_ACCOUNT = $SERVICE_ACCOUNT_EMAIL"
echo -e "GCP_WORKLOAD_IDENTITY_PROVIDER = $WORKLOAD_IDENTITY_PROVIDER"
echo -e "GCP_REGION          = $REGION"