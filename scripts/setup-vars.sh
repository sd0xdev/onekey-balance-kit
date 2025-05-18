#!/bin/bash

# 腳本用於設置部署到 Google Cloud 所需的環境變數

# 顏色設置
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 檢查現有的 .env.gcp 文件
ENV_FILE=".env.gcp"

if [ -f "$ENV_FILE" ]; then
  echo -e "${GREEN}發現現有的 ${ENV_FILE} 文件，將使用其中的值作為默認值${NC}"

  # 讀取現有的值，去除行首的 export 和多餘的空格/引號
  if [ -n "$(grep 'PROJECT_ID=' $ENV_FILE)" ]; then
    DEFAULT_PROJECT_ID=$(grep 'PROJECT_ID=' $ENV_FILE | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
  else
    DEFAULT_PROJECT_ID="one-key-balance-kit"
  fi

  if [ -n "$(grep 'REGION=' $ENV_FILE)" ]; then
    DEFAULT_REGION=$(grep 'REGION=' $ENV_FILE | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
  else
    DEFAULT_REGION="asia-east1"
  fi

  if [ -n "$(grep 'SERVICE_ACCOUNT_NAME=' $ENV_FILE)" ]; then
    DEFAULT_SERVICE_ACCOUNT_NAME=$(grep 'SERVICE_ACCOUNT_NAME=' $ENV_FILE | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
  else
    DEFAULT_SERVICE_ACCOUNT_NAME="github-actions-runner"
  fi

  if [ -n "$(grep 'POOL_ID=' $ENV_FILE)" ]; then
    DEFAULT_POOL_ID=$(grep 'POOL_ID=' $ENV_FILE | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
  else
    DEFAULT_POOL_ID="github-actions-pool"
  fi

  if [ -n "$(grep 'PROVIDER_ID=' $ENV_FILE)" ]; then
    DEFAULT_PROVIDER_ID=$(grep 'PROVIDER_ID=' $ENV_FILE | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
  else
    DEFAULT_PROVIDER_ID="github-provider"
  fi

  if [ -n "$(grep 'GITHUB_USERNAME=' $ENV_FILE)" ]; then
    DEFAULT_GITHUB_USERNAME=$(grep 'GITHUB_USERNAME=' $ENV_FILE | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
  else
    DEFAULT_GITHUB_USERNAME=""
  fi

  if [ -n "$(grep 'GITHUB_REPO=' $ENV_FILE)" ]; then
    GITHUB_REPO_VALUE=$(grep 'GITHUB_REPO=' $ENV_FILE | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
    DEFAULT_REPO_NAME=$(echo "$GITHUB_REPO_VALUE" | cut -d '/' -f2)
  else
    DEFAULT_REPO_NAME="one-key-balance-kit"
  fi
else
  echo -e "${YELLOW}未找到 ${ENV_FILE} 文件，將使用默認值${NC}"
  DEFAULT_PROJECT_ID="one-key-balance-kit"
  DEFAULT_REGION="asia-east1"
  DEFAULT_SERVICE_ACCOUNT_NAME="github-actions-runner"
  DEFAULT_POOL_ID="github-actions-pool"
  DEFAULT_PROVIDER_ID="github-provider"
  DEFAULT_GITHUB_USERNAME=""
  DEFAULT_REPO_NAME="one-key-balance-kit"
fi

# 顯示提示
echo -e "${GREEN}設置 Google Cloud 環境變數${NC}"
echo "此腳本將設置必要的環境變數以便後續部署"
echo -e "${YELLOW}注意：後續腳本 setup-gcp.sh 和 setup-secrets.sh 支持冪等性操作${NC}"
echo -e "${YELLOW}這意味著即使資源已存在，腳本也能安全地重複執行${NC}"

# 設置基本變數
read -p "請輸入 Google Cloud 專案 ID [${DEFAULT_PROJECT_ID}]: " PROJECT_ID
PROJECT_ID=${PROJECT_ID:-"${DEFAULT_PROJECT_ID}"}

read -p "請輸入部署區域 [${DEFAULT_REGION}]: " REGION
REGION=${REGION:-"${DEFAULT_REGION}"}

read -p "請輸入服務帳號名稱 [${DEFAULT_SERVICE_ACCOUNT_NAME}]: " SERVICE_ACCOUNT_NAME
SERVICE_ACCOUNT_NAME=${SERVICE_ACCOUNT_NAME:-"${DEFAULT_SERVICE_ACCOUNT_NAME}"}

read -p "請輸入工作負載身份池 ID [${DEFAULT_POOL_ID}]: " POOL_ID
POOL_ID=${POOL_ID:-"${DEFAULT_POOL_ID}"}

read -p "請輸入工作負載身份提供者 ID [${DEFAULT_PROVIDER_ID}]: " PROVIDER_ID
PROVIDER_ID=${PROVIDER_ID:-"${DEFAULT_PROVIDER_ID}"}

read -p "請輸入您的 GitHub 用戶名 [${DEFAULT_GITHUB_USERNAME}]: " GITHUB_USERNAME
GITHUB_USERNAME=${GITHUB_USERNAME:-"${DEFAULT_GITHUB_USERNAME}"}
if [ -z "$GITHUB_USERNAME" ]; then
  echo -e "${RED}錯誤: GitHub 用戶名不能為空${NC}"
  exit 1
fi

read -p "請輸入存儲庫名稱 [${DEFAULT_REPO_NAME}]: " REPO_NAME
REPO_NAME=${REPO_NAME:-"${DEFAULT_REPO_NAME}"}

# 組合完整的 GitHub 存儲庫名稱
GITHUB_REPO="${GITHUB_USERNAME}/${REPO_NAME}"

# 創建或更新環境變數文件
echo "# Google Cloud 環境變數" > $ENV_FILE
echo "export PROJECT_ID=${PROJECT_ID}" >> $ENV_FILE
echo "export REGION=${REGION}" >> $ENV_FILE
echo "export SERVICE_ACCOUNT_NAME=${SERVICE_ACCOUNT_NAME}" >> $ENV_FILE
echo "export POOL_ID=${POOL_ID}" >> $ENV_FILE
echo "export PROVIDER_ID=${PROVIDER_ID}" >> $ENV_FILE
echo "export GITHUB_USERNAME=${GITHUB_USERNAME}" >> $ENV_FILE
echo "export GITHUB_REPO=${GITHUB_REPO}" >> $ENV_FILE

# 設置服務帳號電子郵件
echo "export SERVICE_ACCOUNT_EMAIL=${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" >> $ENV_FILE

# 輸出結果
echo -e "${GREEN}環境變數已保存到 ${ENV_FILE} 檔案${NC}"
echo -e "${YELLOW}請執行以下命令載入環境變數:${NC}"
echo -e "source ${ENV_FILE}"
echo ""
echo -e "${YELLOW}接下來運行:${NC}"
echo -e "./scripts/setup-gcp.sh"
echo ""
echo -e "${GREEN}完整部署流程:${NC}"
echo -e "1. source ${ENV_FILE}          # 載入環境變數"
echo -e "2. ./scripts/setup-gcp.sh      # 設置 Google Cloud 環境"
echo -e "3. ./scripts/setup-secrets.sh  # 設置密鑰"
