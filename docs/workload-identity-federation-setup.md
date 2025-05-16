# Workload Identity Federation 設置指南

此文檔詳細說明如何設置 Workload Identity Federation，以便 GitHub Actions 可以安全地訪問 Google Cloud 資源，無需使用服務帳號金鑰。

## 目錄

- [什麼是 Workload Identity Federation](#什麼是-workload-identity-federation)
- [優勢](#優勢)
- [設置步驟](#設置步驟)
- [GitHub Actions 配置](#github-actions-配置)
- [常見問題排解](#常見問題排解)

## 什麼是 Workload Identity Federation

Workload Identity Federation 允許外部身份提供者 (如 GitHub) 的工作負載臨時訪問 Google Cloud 資源，無需管理服務帳號金鑰。這是 Google 推薦的安全最佳實踐，可替代傳統的服務帳號金鑰方法。

## 優勢

1. **提高安全性**：無需在 GitHub 中存儲服務帳號密鑰
2. **減少管理負擔**：不需要輪換或管理密鑰
3. **改進審計**：更好的訪問追蹤和日誌記錄
4. **最小權限原則**：可以精確控制哪些 GitHub 工作流程可以訪問特定的 GCP 資源

## 設置步驟

### 自動化設置方法

我們提供了完整的自動化腳本來設置 Workload Identity Federation。這是推薦的設置方法：

1. **設置環境變數**

   ```bash
   # 運行環境變數設置腳本
   ./scripts/setup-vars.sh

   # 載入環境變數
   source .env.gcp
   ```

2. **運行 Google Cloud 設置腳本**

   ```bash
   # 設置 Google Cloud 環境
   ./scripts/setup-gcp.sh
   ```

   此腳本會自動設置 Workload Identity Pool、Provider 和所有必要的權限綁定，並輸出需要添加到 GitHub 的密鑰。

3. **添加 GitHub Secrets**

   將腳本輸出的以下值添加到 GitHub 儲存庫的 Secrets 中：

   - `GCP_PROJECT_ID`
   - `GCP_SERVICE_ACCOUNT`
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`

### 手動設置方法

如果需要手動設置或自訂配置，可以按照以下步驟操作：

#### 1. 創建 Workload Identity Pool

```bash
# 設置環境變數
export PROJECT_ID=one-key-balance-kit
export POOL_ID="github-actions-pool"
export POOL_DISPLAY_NAME="GitHub Actions Pool"

# 創建身份池
gcloud iam workload-identity-pools create ${POOL_ID} \
  --location="global" \
  --display-name="${POOL_DISPLAY_NAME}" \
  --project=${PROJECT_ID}

# 獲取池名稱
export WORKLOAD_IDENTITY_POOL_ID=$(gcloud iam workload-identity-pools describe ${POOL_ID} \
  --location="global" \
  --project=${PROJECT_ID} \
  --format="value(name)")

echo "Workload Identity Pool ID: ${WORKLOAD_IDENTITY_POOL_ID}"
```

#### 2. 創建 Workload Identity Provider

```bash
# 設置環境變數
export PROVIDER_ID="github-provider"
export PROVIDER_DISPLAY_NAME="GitHub Provider"

# 創建提供者
gcloud iam workload-identity-pools providers create-oidc ${PROVIDER_ID} \
  --workload-identity-pool=${POOL_ID} \
  --location="global" \
  --display-name="${PROVIDER_DISPLAY_NAME}" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --project=${PROJECT_ID}

# 獲取提供者名稱
export WORKLOAD_PROVIDER_NAME="${WORKLOAD_IDENTITY_POOL_ID}/providers/${PROVIDER_ID}"

echo "Workload Provider Name: ${WORKLOAD_PROVIDER_NAME}"
```

#### 3. 創建和配置服務帳號

```bash
# 設置環境變數
export SERVICE_ACCOUNT_NAME="github-actions-runner"
export SERVICE_ACCOUNT_DISPLAY_NAME="GitHub Actions Runner"
export GITHUB_REPO="你的GitHub用戶名/one-key-balance-kit"

# 創建服務帳號
gcloud iam service-accounts create ${SERVICE_ACCOUNT_NAME} \
  --display-name="${SERVICE_ACCOUNT_DISPLAY_NAME}" \
  --project=${PROJECT_ID}

# 獲取服務帳號電子郵件
export SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Service Account Email: ${SERVICE_ACCOUNT_EMAIL}"
```

#### 4. 授予服務帳號必要的權限

```bash
# 授權服務帳號訪問 Artifact Registry
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/artifactregistry.writer"

# 授權服務帳號部署 Cloud Run
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/run.admin"

# 授權服務帳號管理 IAM
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

# 授權服務帳號訪問 Secret Manager
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"
```

#### 5. 將 GitHub 存儲庫與服務帳號綁定

```bash
# 綁定 GitHub 存儲庫到服務帳號
gcloud iam service-accounts add-iam-policy-binding ${SERVICE_ACCOUNT_EMAIL} \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${GITHUB_REPO}" \
  --project=${PROJECT_ID}
```

## GitHub Actions 配置

在 GitHub 存儲庫中，您需要添加以下 Secrets：

1. **`GCP_PROJECT_ID`**：您的 Google Cloud 專案 ID
2. **`GCP_SERVICE_ACCOUNT`**：服務帳號電子郵件地址
3. **`GCP_WORKLOAD_IDENTITY_PROVIDER`**：Workload Identity 提供者的完整名稱，格式為：
   `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID`

在 GitHub Actions 工作流程中，使用以下配置進行認證：

```yaml
- name: Google Auth
  id: auth
  uses: 'google-github-actions/auth@v2'
  with:
    workload_identity_provider: '${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}'
    service_account: '${{ secrets.GCP_SERVICE_ACCOUNT }}'
```

## 常見問題排解

### 錯誤：Permission denied

**問題**：`Permission denied when trying to access Google Cloud resources`

**解決方案**：

- 確保服務帳號有正確的權限
- 檢查 GitHub 存儲庫與服務帳號的綁定是否正確
- 確認 Workload Identity Provider 的屬性映射是否正確

### 錯誤：Invalid bearer token

**問題**：`Invalid bearer token from the Workload Identity Provider`

**解決方案**：

- 確保 `GCP_WORKLOAD_IDENTITY_PROVIDER` 格式正確
- 確認發行者 URI 是否設置為 `https://token.actions.githubusercontent.com`
- 檢查 GitHub Actions 工作流程文件中的語法

### 錯誤：Repository not authorized

**問題**：`The repository is not authorized to use the service account`

**解決方案**：

- 確保存儲庫名稱格式正確（`username/repo-name`）
- 檢查 `GITHUB_REPO` 變數是否正確設置
- 驗證 GitHub 存儲庫名稱中的大小寫，應與 GitHub 上顯示的完全一致

### 錯誤：屬性條件必須引用提供者的聲明

**問題**：`The attribute condition must reference one of the provider's claims`

**解決方案**：

- 確保屬性映射正確設置
- 使用推薦的映射：`google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository`
- 避免使用自定義的屬性條件，除非您明確知道如何設置

### 錯誤：無效的目標服務

**問題**：`The target service indicated by the "audience" parameters is invalid` (invalid_target 錯誤)

**解決方案**：

以下是詳細的故障排查指南，按照 GitHub → GCP 的檢查順序：

#### 1️⃣ 先搞清楚 invalid_target 的真正含意

GCP STS 在交換 OIDC token 時，會把 audience（= 你的 Workload Identity Provider 完整資源名稱）拿去比對：

- Pool / Provider 找不到或被標成 DELETED／DISABLED
- audience 字串與實際 Provider 不一致（最常見：把 project ID 填進去，正確要用 project number）

只要對不到，就回 invalid_target。

#### 2️⃣ GitHub 這邊其實只要兩件事

```yaml
permissions:
  contents: read # 讀 repo
  id-token: write # 產 OIDC token
```

✅ 不用額外設定 Secrets，也不用打開甚麼 Beta 旗標；OIDC 流程在所有 GitHub Actions 執行環境預設就開。

#### 3️⃣ GCP 端最常見 5 個踩雷

| #   | 檢查點                                                               | 指令 / 要點                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Provider 路徑一定要用專案編號 (number)                               | `gcloud projects describe $PROJECT_ID --format='value(projectNumber)'` → projects/123456789012/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider                                                                                                                                                        |
| 2   | Provider 狀態是否真的是 ACTIVE                                       | `gcloud iam workload-identity-pools providers describe github-provider \  --location=global --workload-identity-pool=github-actions-pool \  --project=$PROJECT_ID --format='value(state)'`                                                                                                                                                 |
| 3   | Service Account 綁定                                                 | `gcloud iam service-accounts add-iam-policy-binding github-actions-runner@$PROJECT_ID.iam.gserviceaccount.com \  --role=roles/iam.workloadIdentityUser \  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/attribute.repository/sd0xdev/onekey-balance-kit"` |
| 4   | Attribute Mapping 至少要有 attribute.repository=assertion.repository | 少這行時，STS 端雖能找到 Provider，但對不到 claim → 403                                                                                                                                                                                                                                                                                    |
| 5   | IAM 傳播時間                                                         | Pool/Provider 剛 undelete 之後要等 30-180 秒；太快打 STS 也會看到 invalid_target                                                                                                                                                                                                                                                           |

#### 4️⃣ 最快的端到端驗證腳本

在 workflow 裡 auth 成功後，直接跑一段小腳本即可確認 token 能換到 GCP Access Token：

```yaml
- name: Authenticate to Google Cloud
  id: auth
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: 'projects/${{ env.PROJECT_NUMBER }}/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider'
    service_account: 'github-actions-runner@one-key-balance-kit.iam.gserviceaccount.com'
    create_credentials_file: true
    access_token_scopes: 'https://www.googleapis.com/auth/cloud-platform'

- name: Smoke test – list buckets
  env:
    CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE: ${{ steps.auth.outputs.credentials_file_path }}
  run: |
    gcloud storage buckets list --project $PROJECT_ID --limit 1
```

看到任何 GCP 介面呼叫成功，就代表 OIDC → STS → SA impersonation 全線通。

#### 5️⃣ 如果還是卡住就這樣抓 Claim

```yaml
- name: Dump OIDC claim
  if: failure() # 只在失敗時輸出，避免洩漏
  shell: bash
  run: |
    curl -sL "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=${{ env.WIF_PROVIDER }}" \
      -H "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" |\
    jq -r '.value' | \
    awk -F'.' '{print $2}' | base64 -d | jq .
```

- aud 欄位要 完全等於 Provider 資源名稱
- repository claim 要是 sd0xdev/onekey-balance-kit

#### 6️⃣ 常見 QA

| 問題                                        | 解答                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub 需要開什麼額外設定嗎？               | 不用，OIDC channel 預設啟用；Workflow 裡記得 permissions:。                                                                           |
| 能限制只有 develop branch 才能換 token 嗎？ | 可以把 Provider 的 attributeCondition 改成：attribute.repository=='sd0xdev/onekey-balance-kit' && assertion.ref=='refs/heads/develop' |
| Provider 剛恢復就測還會失敗？               | IAM/STS 最長有幾分鐘的 eventual consistency；等個 2-3 分鐘再試。                                                                      |

#### 📌 快速 checklist

- provider 路徑用 project number
- provider state == ACTIVE
- Service Account 綁定 roles/iam.workloadIdentityUser + principalSet://…/attribute.repository/<owner>/<repo>
- workflow permissions: contents:read, id-token:write
- 等待 IAM 傳播 ≥ 2 min 後再次執行 workflow

照這個順序跑，invalid_target 基本上就能解掉。

- 檢查 Workload Identity Pool 和 Provider 是否正確設置並處於活動狀態
- 確認 GitHub 儲存庫名稱與綁定的名稱完全一致
- 檢查並移除不正確的身份綁定：

  ```bash
  # 檢查目前的綁定
  gcloud iam service-accounts get-iam-policy SERVICE_ACCOUNT_EMAIL \
    --project=PROJECT_ID

  # 移除不正確的綁定
  gcloud iam service-accounts remove-iam-policy-binding SERVICE_ACCOUNT_EMAIL \
    --project=PROJECT_ID \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/attribute.repository/INCORRECT_USERNAME/REPO_NAME"
  ```

  替換上述命令中的:

  - `SERVICE_ACCOUNT_EMAIL`: 您的服務帳號電子郵件
  - `PROJECT_ID`: 您的 GCP 專案 ID
  - `PROJECT_NUMBER`: 您的 GCP 專案編號
  - `POOL_ID`: 您的工作負載身份池 ID
  - `INCORRECT_USERNAME`: 不正確的 GitHub 用戶名
  - `REPO_NAME`: 您的儲存庫名稱

---

## 參考資料

- [Google Cloud 官方文檔：Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [GitHub Actions：使用 Google 認證](https://github.com/google-github-actions/auth)
- [Google Cloud 最佳實踐：服務帳號安全](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)

---

本文檔由團隊維護，最後更新日期：2025-05-15
