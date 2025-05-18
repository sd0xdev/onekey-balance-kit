#!/bin/bash
# 取消 set -e，避免因錯誤而立即終止
# set -e

# 此腳本用於將環境變數設置到 Google Cloud Secret Manager
# 用法: ./scripts/setup-secrets.sh [env-file] [environment-name] [specific-keys]
# 例如: ./scripts/setup-secrets.sh .env.staging staging
# 或指定特定密鑰: ./scripts/setup-secrets.sh .env.staging staging MONGO_URL
# 或指定多個密鑰(用逗號分隔): ./scripts/setup-secrets.sh .env.staging staging REDIS_HOST,REDIS_PORT,REDIS_PASSWORD

# 顏色設置
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 預設環境檔案與環境名稱
ENV_FILE=${1:-".env.example"}
# 從環境檔案名稱中提取環境名稱（如果有的話）
if [[ $ENV_FILE =~ \.env\.(.+) ]]; then
  DEFAULT_ENV_NAME="${BASH_REMATCH[1]}"
else
  DEFAULT_ENV_NAME="production"
fi
ENV_NAME=${2:-$DEFAULT_ENV_NAME}  # 如果提供了第二個參數，使用該參數；否則使用從檔案名提取的環境名稱
SPECIFIC_KEYS=${3:-""}  # 可選的特定密鑰參數，可以是逗號分隔的多個密鑰
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-github-actions-runner}"
UPDATE_MODE=false  # 預設非更新模式

# 白名單變數（這些變數將被跳過，不上傳到 Secret Manager）
# 這些變數是從 cloud-run-service.template.yaml 中直接設定的，不需要存在 Secret Manager 中
SKIP_VARS=("NODE_ENV" "PORT" "APP_NAME" "LOG_LEVEL" "API_BASE_URL" "CORS_ORIGIN" "NETWORK_TIMEOUT" "NETWORK_RETRIES" "WEBHOOK_URL")

# 檢查變數是否在白名單中
is_in_skip_list() {
  local var_name="$1"
  for item in "${SKIP_VARS[@]}"; do
    if [[ "$var_name" == "$item" ]]; then
      return 0  # 在白名單中，返回 true
    fi
  done
  return 1  # 不在白名單中，返回 false
}

# 處理單個密鑰
process_specific_key() {
  local key="$1"

  # 檢查密鑰是否在白名單中
  if is_in_skip_list "$key"; then
    echo -e "${RED}錯誤: 指定的密鑰 '$key' 在白名單中，無法處理${NC}"
    return 1
  fi

  # 檢查密鑰是否已存在
  local secret_name="${ENV_NAME}_${key}"
  local update_this_key=false

  if gcloud secrets describe "$secret_name" --project $PROJECT_ID &> /dev/null; then
    echo -e "${YELLOW}密鑰 $secret_name 已存在，將更新該密鑰${NC}"
    update_this_key=true
  else
    echo -e "${GREEN}將創建新密鑰: $secret_name${NC}"
  fi

  # 從環境文件中尋找密鑰值
  local found_in_file=false
  local specific_value=""

  if [ -f "$ENV_FILE" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      # 跳過註釋和空行
      [[ $line =~ ^#.*$ ]] && continue
      [[ -z $line ]] && continue

      # 解析變數名稱和值
      local line_key=$(echo $line | cut -d '=' -f 1)

      # 如果找到指定的密鑰
      if [[ "$line_key" == "$key" ]]; then
        local value=$(echo $line | cut -d '=' -f 2-)
        found_in_file=true
        specific_value="$value"
        echo -e "${GREEN}在環境文件中找到密鑰 $key ${NC}"
        echo -e "${GREEN}密鑰值預覽${NC}: ${value:0:3}$([[ ${#value} -gt 3 ]] && echo '***')"
        break
      fi
    done < "$ENV_FILE"
  fi

  # 如果在文件中沒找到，詢問用戶
  if [[ "$found_in_file" != true ]]; then
    echo -e "${YELLOW}在環境文件 $ENV_FILE 中未找到密鑰 $key${NC}"
    read -p "請輸入 $key 的值 (輸入空值將創建空值密鑰): " specific_value
  fi

  # 確認繼續
  if [[ "$found_in_file" == true ]]; then
    read -p "是否使用環境文件中的值繼續設置此密鑰？ (y/n) " -n 1 -r
  else
    read -p "是否繼續設置此密鑰？ (y/n) " -n 1 -r
  fi
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}跳過此密鑰${NC}"
    return 0
  fi

  # 確保 Secret Manager API 已啟用
  if [[ "$API_ENABLED" != true ]]; then
    echo "確保 Secret Manager API 已啟用..."
    gcloud services enable secretmanager.googleapis.com --project $PROJECT_ID || echo -e "${YELLOW}啟用 Secret Manager API 失敗，可能已啟用${NC}"
    API_ENABLED=true
  fi

  # 處理特定密鑰
  echo "處理密鑰: $secret_name"
  if [[ "$update_this_key" == true ]]; then
    echo -e "${YELLOW}更新現有密鑰 $secret_name...${NC}"
    echo -n "$specific_value" | gcloud secrets versions add "$secret_name" --data-file=- --project $PROJECT_ID || echo -e "${RED}更新密鑰失敗: $secret_name${NC}"
  else
    echo -e "${GREEN}創建新密鑰 $secret_name...${NC}"
    echo -n "$specific_value" | gcloud secrets create "$secret_name" \
      --data-file=- \
      --project $PROJECT_ID \
      --replication-policy="automatic" || echo -e "${RED}創建密鑰失敗: $secret_name - 請檢查錯誤信息${NC}"
  fi

  # 授予 Cloud Run 服務帳號存取權限
  local SERVICE_ACCOUNT="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

  # 檢查服務帳號是否存在
  if ! gcloud iam service-accounts describe $SERVICE_ACCOUNT --project $PROJECT_ID &> /dev/null; then
    echo -e "${RED}警告: 服務帳號 $SERVICE_ACCOUNT 不存在${NC}"
    echo -e "${YELLOW}請先執行 setup-gcp.sh 創建服務帳號${NC}"
  else
    echo "設置服務帳號 $SERVICE_ACCOUNT 存取權限..."
    gcloud secrets add-iam-policy-binding "$secret_name" \
      --member="serviceAccount:$SERVICE_ACCOUNT" \
      --role="roles/secretmanager.secretAccessor" \
      --project $PROJECT_ID || echo -e "${YELLOW}設置密鑰存取權限失敗: $secret_name - 請檢查錯誤信息${NC}"
  fi

  echo -e "${GREEN}已成功設置密鑰: $secret_name${NC}"
  return 0
}

# 檢查環境變數是否設置
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}錯誤: 未設置 PROJECT_ID 環境變數${NC}"
  echo -e "${YELLOW}請先執行 source .env.gcp 或設置 PROJECT_ID 環境變數${NC}"
  exit 1
fi

echo -e "${GREEN}使用專案 ID: $PROJECT_ID${NC}"
echo -e "${GREEN}從檔案載入環境變數: $ENV_FILE${NC}"
echo -e "${GREEN}目標環境: ${ENV_NAME}${NC}"
echo -e "${GREEN}服務帳號: $SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com${NC}"

# 標記API是否已啟用
API_ENABLED=false

# 如果指定了特定密鑰，處理這些密鑰
if [ ! -z "$SPECIFIC_KEYS" ]; then
  # 將逗號分隔的字符串轉換為數組
  IFS=',' read -ra KEY_ARRAY <<< "$SPECIFIC_KEYS"

  if [ ${#KEY_ARRAY[@]} -gt 1 ]; then
    echo -e "${GREEN}將處理 ${#KEY_ARRAY[@]} 個密鑰: ${SPECIFIC_KEYS//,/, }${NC}"
  else
    echo -e "${GREEN}僅處理指定密鑰: $SPECIFIC_KEYS${NC}"
  fi

  # 遍歷所有密鑰並處理
  for key in "${KEY_ARRAY[@]}"; do
    echo -e "\n${YELLOW}================= 處理密鑰: $key =================${NC}"
    process_specific_key "$key"
  done

  echo -e "\n${GREEN}所有指定的密鑰處理完成！${NC}"
  exit 0
fi

# 檢查是否有已存在的密鑰
existing_secrets=$(gcloud secrets list --filter="name:${ENV_NAME}_" --format="value(name)" --project=$PROJECT_ID 2>/dev/null)
if [[ ! -z "$existing_secrets" ]]; then
  echo -e "${YELLOW}已檢測到 ${ENV_NAME} 環境下的現有密鑰${NC}"
  read -p "是否繼續更新密鑰？已存在的密鑰將會被更新 (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}操作已取消${NC}"
    exit 0
  fi
  UPDATE_MODE=true
else
  # 確認繼續
  read -p "是否繼續設置新密鑰？ (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}操作已取消${NC}"
    exit 0
  fi
fi

# 確保 Secret Manager API 已啟用
echo "確保 Secret Manager API 已啟用..."
gcloud services enable secretmanager.googleapis.com --project $PROJECT_ID || echo -e "${YELLOW}啟用 Secret Manager API 失敗，可能已啟用${NC}"
API_ENABLED=true

# 讀取環境檔案並創建密鑰
if [ -f "$ENV_FILE" ]; then
  secrets_count=0
  skipped_count=0
  empty_value_count=0

  while IFS= read -r line || [ -n "$line" ]; do
    # 跳過註釋和空行
    [[ $line =~ ^#.*$ ]] && continue
    [[ -z $line ]] && continue

    # 解析變數名稱和值
    key=$(echo $line | cut -d '=' -f 1)
    value=$(echo $line | cut -d '=' -f 2-)

    # 檢查是否在白名單中，如果是則跳過
    if is_in_skip_list "$key"; then
      echo -e "${YELLOW}跳過白名單變數: $key${NC}"
      ((skipped_count++))
      continue
    fi

    # 記錄空值變數，但仍然創建密鑰
    is_empty=false
    if [[ -z "$value" ]]; then
      echo -e "${YELLOW}變數 $key 的值為空，將創建空值密鑰${NC}"
      is_empty=true
      ((empty_value_count++))
    fi

    # 創建環境命名空間的密鑰名稱，格式為 "ENV_KEY"（使用底線代替斜線）
    secret_name="${ENV_NAME}_${key}"

    echo "處理密鑰: $secret_name"

    # 檢查密鑰是否已存在
    if gcloud secrets describe "$secret_name" --project $PROJECT_ID &> /dev/null; then
      echo -e "${YELLOW}密鑰 $secret_name 已存在，新增版本...${NC}"
      echo -n "$value" | gcloud secrets versions add "$secret_name" --data-file=- --project $PROJECT_ID || echo -e "${RED}新增密鑰版本失敗: $secret_name${NC}"
    else
      echo -e "${GREEN}創建新密鑰 $secret_name...${NC}"
      echo -n "$value" | gcloud secrets create "$secret_name" \
        --data-file=- \
        --project $PROJECT_ID \
        --replication-policy="automatic" || echo -e "${RED}創建密鑰失敗: $secret_name - 請檢查錯誤信息${NC}"
    fi

    # 授予 Cloud Run 服務帳號存取權限
    SERVICE_ACCOUNT="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

    # 檢查服務帳號是否存在
    if ! gcloud iam service-accounts describe $SERVICE_ACCOUNT --project $PROJECT_ID &> /dev/null; then
      echo -e "${RED}警告: 服務帳號 $SERVICE_ACCOUNT 不存在${NC}"
      echo -e "${YELLOW}請先執行 setup-gcp.sh 創建服務帳號${NC}"
    else
      echo "設置服務帳號 $SERVICE_ACCOUNT 存取權限..."
      gcloud secrets add-iam-policy-binding "$secret_name" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --project $PROJECT_ID || echo -e "${YELLOW}設置密鑰存取權限失敗: $secret_name - 請檢查錯誤信息${NC}"
    fi

    echo -e "${GREEN}已設置密鑰: $secret_name${NC}"
    ((secrets_count++))
  done < "$ENV_FILE"

  if [[ "$UPDATE_MODE" == true ]]; then
    echo -e "${GREEN}已成功更新 $secrets_count 個密鑰於 ${ENV_NAME} 環境${NC}"
  else
    echo -e "${GREEN}已成功設置 $secrets_count 個密鑰於 ${ENV_NAME} 環境${NC}"
  fi
  echo -e "${YELLOW}已跳過 $skipped_count 個白名單變數${NC}"
  if [[ $empty_value_count -gt 0 ]]; then
    echo -e "${YELLOW}已創建 $empty_value_count 個空值密鑰${NC}"
  fi
else
  echo -e "${RED}找不到環境檔案: $ENV_FILE${NC}"
  exit 1
fi

# 輸出如何在 Cloud Run 中使用這些密鑰
echo ""
echo -e "${GREEN}=== 在 Cloud Run 中使用這些密鑰 ===${NC}"
echo -e "${YELLOW}在 GitHub Actions 工作流程中添加以下配置:${NC}"
echo ""
echo "secrets: |"

while IFS= read -r line || [ -n "$line" ]; do
  # 跳過註釋和空行
  [[ $line =~ ^#.*$ ]] && continue
  [[ -z $line ]] && continue

  # 獲取變數名稱和值
  key=$(echo $line | cut -d '=' -f 1)

  # 檢查是否在白名單中，如果是則跳過
  if is_in_skip_list "$key"; then
    continue
  fi

  secret_name="${ENV_NAME}_${key}"
  echo "  $key=$secret_name:latest"
done < "$ENV_FILE"

echo ""
echo -e "${GREEN}如果使用 Google Cloud 控制台部署 Cloud Run 服務，可以選擇引用密鑰:${NC}"
echo -e "${YELLOW}1. 作為環境變數：${ENV_NAME}_<密鑰名稱>${NC}"
echo -e "${YELLOW}2. 作為掛載文件：將密鑰掛載到容器內，路徑如 /secrets/${ENV_NAME}/${NC}"
echo ""
echo -e "${GREEN}密鑰設置完成！${NC}"
echo -e "${YELLOW}可以使用以下命令查看特定環境的密鑰:${NC}"
echo -e "gcloud secrets list --filter=\"name:${ENV_NAME}_\" --project=${PROJECT_ID}"
