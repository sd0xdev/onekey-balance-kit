#!/bin/bash
set -e

# ---------- 顏色設置 ----------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ---------- 工作目錄 ----------
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# ---------- 配置 ----------
CLOUDBUILD_FILE="$ROOT_DIR/cloudbuild.yaml"
TEST_DIR="$ROOT_DIR/test-build"
TEST_ENV="${1:-staging}"  # 第一個參數或默認值

# ---------- 輔助函數 ----------
header() {
  echo -e "\n${BOLD}${BLUE}### $1 ###${NC}\n"
}

success() {
  echo -e "${GREEN}$1${NC}"
}

warning() {
  echo -e "${YELLOW}$1${NC}"
}

error() {
  echo -e "${RED}$1${NC}"
  if [ "$2" == "exit" ]; then
    exit 1
  fi
}

# ---------- 檢查文件存在 ----------
if [ ! -f "$CLOUDBUILD_FILE" ]; then
  error "找不到 cloudbuild.yaml 文件" "exit"
fi

# ---------- 建立測試目錄 ----------
mkdir -p "$TEST_DIR"
echo "創建測試目錄: $TEST_DIR"

# ---------- 定義測試環境變數 ----------
TEST_PROJECT_ID="one-key-balance-kit"
TEST_REGION="asia-east1"
TEST_SHA="test123"
TEST_MAX_INSTANCES="2"

# 根據環境設置額外變數
if [ "$TEST_ENV" == "production" ]; then
  echo "測試生產環境 (production)"
else
  echo "測試測試環境 (staging)"
fi

# ---------- 檢測變量引用 ----------
header "檢測 Cloud Build 變數引用"
VAR_REFS=$(grep -o '\${[^}]*}' "$CLOUDBUILD_FILE" | sort -u)
echo "在 cloudbuild.yaml 中找到以下變數引用:"
echo "$VAR_REFS"

# 檢查潛在問題變數
PROBLEM_VARS=$(echo "$VAR_REFS" | grep -v '\${_\|PROJECT_ID\|SHORT_SHA}')
if [ -n "$PROBLEM_VARS" ]; then
  warning "發現可能有問題的變數引用:"
  echo "$PROBLEM_VARS"
fi

# ---------- 進行變數替換測試 ----------
header "進行變數替換測試"

# 複製並處理檔案
TEST_BUILD_FILE="$TEST_DIR/cloudbuild-test.yaml"
cp "$CLOUDBUILD_FILE" "$TEST_BUILD_FILE"

# 對測試檔案進行變數替換
echo "替換測試值:"
echo " - _ENV: $TEST_ENV"
echo " - _REGION: $TEST_REGION"
echo " - PROJECT_ID: $TEST_PROJECT_ID"
echo " - SHORT_SHA: $TEST_SHA"
echo " - _MAX_INSTANCES: $TEST_MAX_INSTANCES"

# 使用 sed 進行替換 (使用不同分隔符避免路徑中的 / 造成問題)
sed -i "s|\${_ENV}|$TEST_ENV|g" "$TEST_BUILD_FILE"
sed -i "s|\${_REGION}|$TEST_REGION|g" "$TEST_BUILD_FILE"
sed -i "s|\${SHORT_SHA}|$TEST_SHA|g" "$TEST_BUILD_FILE"
sed -i "s|\$PROJECT_ID|$TEST_PROJECT_ID|g" "$TEST_BUILD_FILE"
sed -i "s|\${_MAX_INSTANCES}|$TEST_MAX_INSTANCES|g" "$TEST_BUILD_FILE"

# 檢查替換後的檔案中是否還有變數引用
REMAINING_VARS=$(grep -o '\${[^}]*}' "$TEST_BUILD_FILE" | sort -u)
if [ -n "$REMAINING_VARS" ]; then
  warning "替換後仍有以下未解析的變數引用:"
  echo "$REMAINING_VARS"
else
  success "所有基本變數均已成功替換"
fi

# ---------- 生成純 Bash 測試腳本 ----------
header "生成純 Bash 測試腳本"

# 提取第一個步驟的 Bash 腳本
BASH_TEST_FILE="$TEST_DIR/build-image-test.sh"
BUILD_SCRIPT=$(grep -A 1000 "args:" "$TEST_BUILD_FILE" | grep -m 1 -B 1000 "# ---" | grep -v "args:" | grep -v "# ---" | sed 's/^[ \t]*//')
echo "#!/bin/bash" > "$BASH_TEST_FILE"
echo "" >> "$BASH_TEST_FILE"
echo "# 測試環境設置" >> "$BASH_TEST_FILE"
echo "export PROJECT_ID=\"$TEST_PROJECT_ID\"" >> "$BASH_TEST_FILE"
echo "export SHORT_SHA=\"$TEST_SHA\"" >> "$BASH_TEST_FILE"
echo "export _ENV=\"$TEST_ENV\"" >> "$BASH_TEST_FILE"
echo "export _REGION=\"$TEST_REGION\"" >> "$BASH_TEST_FILE"
echo "export _MAX_INSTANCES=\"$TEST_MAX_INSTANCES\"" >> "$BASH_TEST_FILE"
echo "" >> "$BASH_TEST_FILE"
echo "# 測試腳本 (從 Cloud Build 提取)" >> "$BASH_TEST_FILE"
echo "$BUILD_SCRIPT" >> "$BASH_TEST_FILE"
echo "echo \"測試完成！\"" >> "$BASH_TEST_FILE"

# 提取第二個步驟的 Bash 腳本
BASH_DEPLOY_FILE="$TEST_DIR/deploy-test.sh"
DEPLOY_SCRIPT=$(grep -A 1000 "# --- 2)" "$TEST_BUILD_FILE" | grep -A 1000 "args:" | grep -m 1 -B 1000 "images:" | grep -v "args:" | grep -v "images:" | sed 's/^[ \t]*//' | grep -v "^-")
echo "#!/bin/bash" > "$BASH_DEPLOY_FILE"
echo "" >> "$BASH_DEPLOY_FILE"
echo "# 測試環境設置" >> "$BASH_DEPLOY_FILE"
echo "export PROJECT_ID=\"$TEST_PROJECT_ID\"" >> "$BASH_DEPLOY_FILE"
echo "export SHORT_SHA=\"$TEST_SHA\"" >> "$BASH_DEPLOY_FILE"
echo "export _ENV=\"$TEST_ENV\"" >> "$BASH_DEPLOY_FILE"
echo "export _REGION=\"$TEST_REGION\"" >> "$BASH_DEPLOY_FILE"
echo "export _MAX_INSTANCES=\"$TEST_MAX_INSTANCES\"" >> "$BASH_DEPLOY_FILE"
echo "" >> "$BASH_DEPLOY_FILE"
echo "# 測試腳本 (從 Cloud Build 提取)" >> "$BASH_DEPLOY_FILE"
echo "$DEPLOY_SCRIPT" >> "$BASH_DEPLOY_FILE"
echo "echo \"測試完成！\"" >> "$BASH_DEPLOY_FILE"

# 設置可執行權限
chmod +x "$BASH_TEST_FILE"
chmod +x "$BASH_DEPLOY_FILE"

success "純 Bash 測試腳本已生成:"
echo "構建映像腳本: $BASH_TEST_FILE"
echo "部署測試腳本: $BASH_DEPLOY_FILE"

# ---------- gcloud 模擬測試命令 ----------
header "模擬 Cloud Build 測試命令"

if command -v gcloud &> /dev/null; then
  echo -e "您可以使用以下 ${CYAN}gcloud${NC} 命令進行無源碼測試:"
  echo -e "${CYAN}gcloud builds submit --no-source \\
  --config=$TEST_BUILD_FILE \\
  --substitutions=_ENV=$TEST_ENV,_REGION=$TEST_REGION,_MAX_INSTANCES=$TEST_MAX_INSTANCES \\
  --project=$TEST_PROJECT_ID${NC}"
  echo ""
  echo -e "${YELLOW}注意: 這個命令不會實際執行構建，但會驗證配置文件語法${NC}"
else
  warning "未找到 gcloud 命令，無法提供測試命令"
fi

# ---------- 測試構建腳本 ----------
header "執行純 Bash 測試腳本 (dry run)"

echo -e "${YELLOW}若要在本地執行構建映像測試腳本 (不實際構建):${NC}"
echo -e "${CYAN}bash -n $BASH_TEST_FILE${NC}"
echo ""
echo -e "${YELLOW}若要在本地執行部署測試腳本 (不實際部署):${NC}"
echo -e "${CYAN}bash -n $BASH_DEPLOY_FILE${NC}"
echo ""

# ---------- 完成 ----------
header "測試環境準備完成"
echo "測試文件位於: $TEST_DIR"
echo ""
echo -e "${YELLOW}提示:${NC}"
echo "1. 查看 $TEST_BUILD_FILE 確認變數替換是否正確"
echo "2. 使用 bash -n 檢查腳本語法"
echo "3. 若需在本地執行構建腳本（不實際推送映像），請修改腳本移除 --push 參數"
echo ""
success "測試準備完成！"
