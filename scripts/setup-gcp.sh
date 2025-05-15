#!/bin/bash
# 取消 set -e，避免因錯誤而立即終止
# set -e

# 此腳本用於設置 Google Cloud 環境以進行部署
# 請先執行 scripts/setup-vars.sh 設置必要的環境變數

# 顏色設置
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 檢查環境變數是否設置
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}錯誤: 未設置 PROJECT_ID 環境變數${NC}"
  echo -e "${YELLOW}請先執行 source .env.gcp 或 ./scripts/setup-vars.sh${NC}"
  exit 1
fi

if [ -z "$GITHUB_REPO" ]; then
  echo -e "${RED}錯誤: 未設置 GITHUB_REPO 環境變數${NC}"
  echo -e "${YELLOW}請先執行 source .env.gcp 或 ./scripts/setup-vars.sh${NC}"
  exit 1
fi

# 設置變數，使用環境變數或默認值
PROJECT_ID="${PROJECT_ID}"
REGION="${REGION:-asia-east1}"
REPOSITORY_NAME="${REPOSITORY_NAME:-one-key-balance-kit}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-github-actions-runner}"
SERVICE_ACCOUNT_DISPLAY_NAME="${SERVICE_ACCOUNT_DISPLAY_NAME:-GitHub Actions Runner}"
POOL_ID="${POOL_ID:-github-actions-pool}"
POOL_DISPLAY_NAME="${POOL_DISPLAY_NAME:-GitHub Actions Pool}"
PROVIDER_ID="${PROVIDER_ID:-github-provider}"
PROVIDER_DISPLAY_NAME="${PROVIDER_DISPLAY_NAME:-GitHub Provider}"

# 設置服務帳號電子郵件
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_EMAIL:-$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com}"

echo -e "${GREEN}設置 Google Cloud 環境，專案: $PROJECT_ID，區域: $REGION${NC}"

# 確保已啟用所需的 API
echo "啟用必要的 API..."
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  secretmanager.googleapis.com \
  --project $PROJECT_ID

# 創建 Artifact Registry 存儲庫（冪等操作）
echo "創建 Artifact Registry 儲存庫..."
if gcloud artifacts repositories describe $REPOSITORY_NAME --location=$REGION --project $PROJECT_ID &> /dev/null; then
  echo -e "${YELLOW}儲存庫 $REPOSITORY_NAME 已存在${NC}"
else
  # 使用 || true 確保即使命令失敗也不會中斷腳本
  gcloud artifacts repositories create $REPOSITORY_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Docker images for $REPOSITORY_NAME" \
    --project $PROJECT_ID 2>/dev/null || echo -e "${YELLOW}儲存庫 $REPOSITORY_NAME 已存在或創建失敗${NC}"
fi

# 創建服務帳號（冪等操作）
echo "創建服務帳號..."
if gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL --project $PROJECT_ID &> /dev/null; then
  echo -e "${YELLOW}服務帳號 $SERVICE_ACCOUNT_EMAIL 已存在${NC}"
else
  # 使用 || true 確保即使命令失敗也不會中斷腳本
  gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="$SERVICE_ACCOUNT_DISPLAY_NAME" \
    --project $PROJECT_ID 2>/dev/null || echo -e "${YELLOW}服務帳號 $SERVICE_ACCOUNT_NAME 已存在或創建失敗${NC}"
fi

# 授予服務帳號權限
echo "授予服務帳號權限..."

# Artifact Registry 權限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/artifactregistry.writer" \
  --condition=None || echo -e "${YELLOW}設置 Artifact Registry 權限失敗，可能已存在${NC}"

# Cloud Run 權限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/run.admin" \
  --condition=None || echo -e "${YELLOW}設置 Cloud Run 權限失敗，可能已存在${NC}"

# IAM 權限（用於令牌創建）
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None || echo -e "${YELLOW}設置 IAM 權限失敗，可能已存在${NC}"

# Secret Manager 權限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None || echo -e "${YELLOW}設置 Secret Manager 權限失敗，可能已存在${NC}"

echo -e "${GREEN}權限已授予${NC}"

# 創建 Workload Identity Pool（冪等操作）
echo "設置工作負載身份聯合..."
if gcloud iam workload-identity-pools describe $POOL_ID --location="global" --project $PROJECT_ID &> /dev/null; then
  echo -e "${YELLOW}工作負載身份池 $POOL_ID 已存在${NC}"
else
  # 使用 || true 確保即使命令失敗也不會中斷腳本
  gcloud iam workload-identity-pools create $POOL_ID \
    --location="global" \
    --display-name="$POOL_DISPLAY_NAME" \
    --project $PROJECT_ID 2>/dev/null || echo -e "${YELLOW}工作負載身份池 $POOL_ID 已存在或創建失敗${NC}"
fi

# 獲取池名稱（即使前面的創建失敗也嘗試獲取）
WORKLOAD_IDENTITY_POOL_ID=$(gcloud iam workload-identity-pools describe $POOL_ID \
  --location="global" \
  --project $PROJECT_ID \
  --format="value(name)" 2>/dev/null || echo "projects/$PROJECT_ID/locations/global/workloadIdentityPools/$POOL_ID")

# 創建提供者（冪等操作）
PROVIDER_PATH="projects/$PROJECT_ID/locations/global/workloadIdentityPools/$POOL_ID/providers/$PROVIDER_ID"
if gcloud iam workload-identity-pools providers describe $PROVIDER_ID \
    --workload-identity-pool=$POOL_ID \
    --location="global" \
    --project $PROJECT_ID &> /dev/null; then
  echo -e "${YELLOW}工作負載身份提供者 $PROVIDER_ID 已存在${NC}"
else
  # 使用 || true 確保即使命令失敗也不會中斷腳本
  gcloud iam workload-identity-pools providers create-oidc $PROVIDER_ID \
    --workload-identity-pool=$POOL_ID \
    --location="global" \
    --display-name="$PROVIDER_DISPLAY_NAME" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --project $PROJECT_ID 2>/dev/null || echo -e "${YELLOW}工作負載身份提供者 $PROVIDER_ID 已存在或創建失敗${NC}"
fi

# 綁定 GitHub repo 到服務帳號
echo "綁定 GitHub 存儲庫 ${GITHUB_REPO} 到服務帳號..."
gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT_EMAIL \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${GITHUB_REPO}" \
  --project $PROJECT_ID 2>/dev/null || echo -e "${YELLOW}綁定 GitHub 存儲庫失敗，可能已存在${NC}"

WORKLOAD_IDENTITY_PROVIDER="projects/$PROJECT_ID/locations/global/workloadIdentityPools/$POOL_ID/providers/$PROVIDER_ID"

# 輸出設置信息
echo ""
echo -e "${GREEN}=== 設置完成 ===${NC}"
echo -e "${YELLOW}請將以下密鑰添加到您的 GitHub 存儲庫:${NC}"
echo ""
echo "GCP_PROJECT_ID: $PROJECT_ID"
echo "GCP_SERVICE_ACCOUNT: $SERVICE_ACCOUNT_EMAIL"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER: $WORKLOAD_IDENTITY_PROVIDER"
echo ""
echo -e "${YELLOW}請將以下變數添加到您的 GitHub 存儲庫:${NC}"
echo "GCP_REGION: $REGION"
echo ""
echo -e "${YELLOW}請按照文檔在 Secret Manager 中創建所需的密鑰。${NC}"
