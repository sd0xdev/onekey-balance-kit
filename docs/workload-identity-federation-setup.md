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

---

## 參考資料

- [Google Cloud 官方文檔：Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [GitHub Actions：使用 Google 認證](https://github.com/google-github-actions/auth)
- [Google Cloud 最佳實踐：服務帳號安全](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)

---

本文檔由團隊維護，最後更新日期：2023-05-20
