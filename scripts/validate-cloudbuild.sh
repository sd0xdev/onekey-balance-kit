#!/bin/bash

# ---------- 顏色設置 ----------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ---------- 工作目錄 ----------
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# ---------- 載入 GCP 環境變數 (如果存在) ----------
ENV_FILE="$ROOT_DIR/.env.gcp"
if [ -f "$ENV_FILE" ]; then
  echo -e "${CYAN}載入 GCP 環境變數: $ENV_FILE${NC}"
  source "$ENV_FILE"
  PROJECT_ID_FROM_ENV=$PROJECT_ID
  REGION_FROM_ENV=$REGION
else
  echo -e "${YELLOW}注意: 找不到 .env.gcp 文件，將使用預設測試值${NC}"
fi

# ---------- 檢查必要工具 ----------
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}錯誤: 找不到命令 '$1'${NC}"
    echo -e "請先安裝該命令，若使用 macOS，可以運行: ${CYAN}brew install $2${NC}"
    exit 1
  fi
}

# 檢查基本工具
check_command "grep" "grep"
check_command "sed" "gnu-sed"
check_command "awk" "awk"

# ---------- 輔助函數 ----------
section() {
  local title="$1"
  echo -e "\n${BOLD}${CYAN}=== $title ===${NC}"
}

pass() {
  echo -e "${GREEN}✓ $1${NC}"
}

warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
  echo -e "${RED}✗ $1${NC}"
}

info() {
  echo -e "${CYAN}ℹ $1${NC}"
}

# ---------- 檢查文件存在 ----------
CLOUDBUILD_FILE="$ROOT_DIR/cloudbuild.yaml"
if [ ! -f "$CLOUDBUILD_FILE" ]; then
  error "找不到 $CLOUDBUILD_FILE 文件"
  exit 1
fi

section "檢查 Cloud Build 配置文件"
info "雲構建配置文件路徑: $CLOUDBUILD_FILE"

# ---------- 檢查 YAML 語法 ----------
section "檢查 YAML 語法"
if command -v yamllint &> /dev/null; then
  yamllint -d relaxed "$CLOUDBUILD_FILE"
  if [ $? -eq 0 ]; then
    pass "YAML 語法正確"
  else
    error "YAML 語法錯誤"
  fi
else
  warn "yamllint 未安裝，跳過 YAML 語法檢查"
  echo -e "可通過運行 ${CYAN}brew install yamllint${NC} 安裝"
fi

# ---------- 檢查 Cloud Build 變數語法 ----------
section "檢查 Cloud Build 變數語法"

# 檢查所有 ${...} 格式的變數引用
echo -e "找到的變數引用:"
VARS=$(grep -o '\${[^}]*}' "$CLOUDBUILD_FILE" | sort -u)
echo "$VARS" | while read -r var; do
  # 去除 ${ 和 }
  varname=${var:2:-1}

  # 檢查是否符合 Cloud Build 變數命名規則
  if [[ "$varname" == _* ]] || [[ "$varname" == "PROJECT_ID" ]] || [[ "$varname" == "SHORT_SHA" ]]; then
    echo -e "  ${GREEN}$var${NC} - 有效的 Cloud Build 變數"
  # 檢查是否包含 Bash 特殊語法
  elif [[ "$varname" == *":-"* ]]; then
    error "  $var - 包含 Bash 預設值語法，不被 Cloud Build 支持"
  else
    warn "  $var - 不是標準的 Cloud Build 內建或自訂變數"
  fi
done

# ---------- 檢查 Bash 變數使用 ----------
section "檢查 Bash 變數使用"

# 查找所有使用 ${VARNAME} 格式但不在引號內的變數
bash_vars=$(grep -o '\${[A-Za-z0-9_]*\}' "$CLOUDBUILD_FILE" | grep -v '\${_\|PROJECT_ID\|SHORT_SHA}')
if [ -n "$bash_vars" ]; then
  warn "找到可能被 Cloud Build 誤解的 Bash 變數:"
  echo "$bash_vars"
  echo -e "建議: 在 Bash 腳本中使用 \$VAR 而不是 \${VAR} 格式"
else
  pass "未發現可能被 Cloud Build 誤解的 Bash 變數"
fi

# ---------- 模擬 Cloud Build 變數替換 ----------
section "模擬 Cloud Build 變數替換"

# 定義測試環境 (優先使用 .env.gcp 中的值)
TEST_ENV="staging"
TEST_REGION=${REGION_FROM_ENV:-"asia-east1"}
TEST_PROJECT=${PROJECT_ID_FROM_ENV:-"test-project"}
TEST_SHA="abcdef123"

# 創建臨時文件
TEMP_FILE=$(mktemp)
cat "$CLOUDBUILD_FILE" > "$TEMP_FILE"

# 模擬簡單的變數替換
sed -i "s/\${_ENV}/$TEST_ENV/g" "$TEMP_FILE"
sed -i "s/\${_REGION}/$TEST_REGION/g" "$TEMP_FILE"
sed -i "s/\${SHORT_SHA}/$TEST_SHA/g" "$TEMP_FILE"
sed -i "s/\$PROJECT_ID/$TEST_PROJECT/g" "$TEMP_FILE"

info "已建立模擬變數替換後的臨時檔: $TEMP_FILE"
info "測試環境: env=$TEST_ENV, region=$TEST_REGION, project=$TEST_PROJECT, sha=$TEST_SHA"

# 檢查替換後是否仍有變數引用
remaining_vars=$(grep -o '\${[^}]*}' "$TEMP_FILE" | sort -u)
if [ -n "$remaining_vars" ]; then
  warn "替換後仍有未解析的變數引用:"
  echo "$remaining_vars"
else
  pass "所有變數均成功替換"
fi

# ---------- 驗證可能的部署步驟 ----------
section "驗證可能的部署步驟"

# 詢問是否要執行無源碼測試
if command -v gcloud &> /dev/null; then
  # 準備命令
  EXECUTE_CMD="gcloud builds submit --no-source \\
  --config=$CLOUDBUILD_FILE \\
  --substitutions=_ENV=$TEST_ENV,_REGION=$TEST_REGION,_MAX_INSTANCES=1,_GIT_SHA=$TEST_SHA \\
  --project=$TEST_PROJECT"

  echo -e "${CYAN}以下是無源碼驗證命令:${NC}"
  echo -e "${CYAN}$EXECUTE_CMD${NC}"

  # 詢問是否執行
  echo ""
  read -p "是否執行上述命令進行無源碼驗證? (y/N): " DO_EXECUTE

  if [[ "$DO_EXECUTE" == "y" || "$DO_EXECUTE" == "Y" ]]; then
    echo -e "\n${YELLOW}執行無源碼驗證...${NC}"
    eval "$EXECUTE_CMD"
    if [ $? -eq 0 ]; then
      pass "無源碼驗證成功"
    else
      error "無源碼驗證失敗"
    fi
  else
    info "已跳過執行"
  fi
else
  warn "gcloud 命令未找到，無法提供部署驗證指令"
fi

# ---------- 清理臨時文件 ----------
rm -f "$TEMP_FILE"

section "整體評估"
echo -e "cloudbuild.yaml 驗證已完成。請檢查上述報告中的任何錯誤或警告。"
echo -e "如需進一步驗證，您可以使用 gcloud CLI 進行無源碼測試。"

exit 0
