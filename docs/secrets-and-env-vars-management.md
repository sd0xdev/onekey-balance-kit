# 環境變數和密鑰管理指南

本文檔詳細說明如何在 Google Cloud Run 和 GitHub Actions CI/CD 流程中管理環境變數和密鑰。

## 目錄

- [環境變數類型](#環境變數類型)
- [Google Cloud Secret Manager](#google-cloud-secret-manager)
- [GitHub Repository 變數和密鑰](#github-repository-變數和密鑰)
- [設置流程](#設置流程)
- [最佳實踐](#最佳實踐)
- [故障排除](#故障排除)

## 環境變數類型

在處理部署和 CI/CD 流程時，我們將環境變數分為兩類：

### 1. 非敏感配置

適合直接設置在 CI/CD 流程或部署配置中的環境變數：

- `NODE_ENV`：環境類型（如 `development` 或 `production`）
- `PORT`：服務埠號
- `APP_NAME`：應用程式名稱
- `LOG_LEVEL`：日誌級別（如 `debug` 或 `info`）
- `API_BASE_URL`：API 基礎 URL
- `CORS_ORIGIN`：CORS 允許的來源
- `NETWORK_TIMEOUT`：網路操作超時設定
- `NETWORK_RETRIES`：網路操作重試次數

### 2. 敏感密鑰

必須安全儲存在 Secret Manager 中的敏感資訊：

- MongoDB 相關設置（`MONGO_URL`, `MONGO_HOST`, `MONGO_USERNAME`, `MONGO_PASSWORD` 等）
- Redis 相關設置（`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` 等）
- API 和區塊鏈相關密鑰（`ALCHEMY_API_KEY_*`, `QUICKNODE_*_URL`, `OKX_*` 等）
- `RPC_URL`：區塊鏈節點 RPC 連接 URL
- `API_KEY`：API 認證密鑰

## Google Cloud Secret Manager

Google Cloud Secret Manager 是一個安全的密鑰儲存服務，可用於存儲敏感的配置值。

### 為什麼使用 Secret Manager

- **集中管理**：所有密鑰在一個中央位置管理
- **版本控制**：自動保留密鑰的版本歷史
- **精細控制**：可以為每個密鑰設置不同的存取控制
- **與 Cloud Run 集成**：Cloud Run 可以直接掛載密鑰作為環境變數

### 密鑰命名格式

我們使用以下命名格式來管理密鑰：

```
環境名稱_密鑰名稱
```

例如：

- `production_MONGO_URL`
- `staging_REDIS_PASSWORD`
- `production_ALCHEMY_API_KEY_ETH`

此格式確保密鑰在不同環境中明確分離，並且符合 Google Cloud Secret Manager 的命名規則。

## GitHub Repository 變數和密鑰

GitHub 提供了兩種存儲配置的方式：

### 1. GitHub Secrets

用於存儲敏感資訊，這些值在工作流程中使用時會被掩蓋，無法在日誌中查看。

我們需要添加的密鑰：

- `GCP_PROJECT_ID`：Google Cloud 專案 ID
- `GCP_SERVICE_ACCOUNT`：服務帳號電子郵件
- `GCP_WORKLOAD_IDENTITY_PROVIDER`：Workload Identity 提供者

### 2. GitHub Variables

用於存儲非敏感配置，這些值可以直接在工作流程日誌中查看。

我們需要添加的變數：

- `GCP_REGION`：部署區域（如 `asia-east1`）
- `DEV_API_BASE_URL`：開發環境 API 基礎 URL
- `PROD_API_BASE_URL`：生產環境 API 基礎 URL
- `DEV_CORS_ORIGIN`：開發環境 CORS 來源
- `PROD_CORS_ORIGIN`：生產環境 CORS 來源

### 不需要手動設置的變數

以下變數在 GitHub Actions 工作流程中自動設置，不需要手動添加：

- `NODE_ENV`
- `ENV_SUFFIX`
- `IMAGE_SUFFIX`
- `MAX_INSTANCES`
- `LOG_LEVEL`
- `SECRET_PREFIX`
- `SERVICE_NAME`
- `CACHE_TTL`
- `DEPLOY_TAG`
- `IMAGE_TAG`

## 設置流程

### 1. 設置環境變數

首先，我們需要設置 Google Cloud 環境變數：

```bash
# 運行環境變數設置腳本
./scripts/setup-vars.sh

# 載入環境變數
source .env.gcp
```

此腳本會引導您輸入所有必要的環境變數，並將它們保存到 `.env.gcp` 文件中供後續使用。

### 2. 設置 Google Cloud 環境

確保已經設置了 Google Cloud 環境，包括服務帳號和權限：

```bash
# 使用環境變數運行 Google Cloud 設置腳本
./scripts/setup-gcp.sh
```

### 3. 設置 Secret Manager 密鑰

我們提供了自動化腳本 `scripts/setup-secrets.sh` 來將環境變數上傳到 Secret Manager。現在腳本會自動從環境檔案名稱中提取環境名稱：

```bash
# 使用 .env.staging 上傳密鑰，自動設定環境為 staging
./scripts/setup-secrets.sh .env.staging

# 使用 .env.production 上傳密鑰，自動設定環境為 production
./scripts/setup-secrets.sh .env.production

# 也可以明確指定環境名稱
./scripts/setup-secrets.sh .env.example production

# 只更新/上傳特定的單一密鑰
./scripts/setup-secrets.sh .env.staging staging MONGO_URL
```

腳本會自動：

1. 從檔案名稱提取環境名稱（如 .env.staging → staging）
2. 檢測是否存在現有密鑰，並詢問是否繼續更新
3. 讀取環境文件中的每一行
4. 跳過註釋、空行和白名單中的變數
5. 對於空值變數，仍然創建密鑰但值為空字串
6. 將每個變數上傳到 Secret Manager，格式為 `環境名稱_變數名稱`
7. 為 Cloud Run 服務帳號授予存取權限
8. 輸出在 GitHub Actions 工作流程中使用的配置
9. 顯示已處理、已跳過和空值密鑰的數量統計

### 單一密鑰模式

如果只需要更新特定的一個密鑰，可以使用第三個參數指定密鑰名稱：

```bash
./scripts/setup-secrets.sh .env.staging staging API_KEY
```

在這種模式下，腳本會：

1. 檢查指定的密鑰是否在白名單中（如果是則拒絕處理）
2. 檢查密鑰是否已存在於 Secret Manager 中
3. **先在環境文件中尋找該密鑰的值，並顯示部分值以供確認**
4. 如果環境文件中沒有找到，才會提示輸入新值
5. 確認是否使用找到的值或輸入的值繼續操作
6. 創建或更新該密鑰
7. 為服務帳號授予存取權限

這對於需要快速更新單個敏感配置（如 API 密鑰或資料庫憑證）而不想處理整個配置文件時非常有用。同時，從環境文件中自動獲取值的功能可以減少手動輸入錯誤的風險。

### 白名單變數

以下變數會被跳過，不會上傳到 Secret Manager：

```bash
NODE_ENV
PORT
APP_NAME
LOG_LEVEL
API_BASE_URL
CORS_ORIGIN
NETWORK_TIMEOUT
NETWORK_RETRIES
```

這些變數會在部署時直接在 Cloud Run 配置中設置。

### 4. 設置 GitHub Secrets 和 Variables

在 GitHub Repository 中：

1. 前往 Settings > Secrets and variables > Actions
2. 在 Secrets 選項卡中，添加 `setup-gcp.sh` 腳本輸出的以下值：
   - `GCP_PROJECT_ID`
   - `GCP_SERVICE_ACCOUNT`
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`
3. 在 Variables 選項卡中，添加：
   - `GCP_REGION`
   - `DEV_API_BASE_URL`
   - `PROD_API_BASE_URL`
   - `DEV_CORS_ORIGIN`
   - `PROD_CORS_ORIGIN`

### 5. 在 GitHub Actions 工作流程中使用

在 GitHub Actions 工作流程文件中，密鑰引用現在使用以下格式：

```yaml
# cloud-run-service.template.yaml 中的密鑰引用
env:
  - name: MONGO_URL
    valueFrom:
      secretKeyRef:
        name: ${SECRET_PREFIX}_MONGO_URL
        key: latest
```

部署時，`${SECRET_PREFIX}` 會被替換為實際環境名稱（如 `staging` 或 `production`）。

## 最佳實踐

### 環境分離

- **開發環境**：使用 `-dev` 後綴命名服務和資源
- **生產環境**：使用標準命名（無後綴）
- **為每個環境維護單獨的密鑰集**：使用 `環境名稱_密鑰名稱` 格式區分不同環境的密鑰

### 密鑰輪換

- **定期更新敏感密鑰**：至少每 90 天
- **自動輪換**：使用 Secret Manager 的自動輪換功能
- **跟踪版本**：在 Cloud Run 中使用 `:latest` 標記以獲取最新版本

### 最小權限原則

- **限制服務帳號權限**：僅授予最小必要的權限
- **限制密鑰存取**：只有需要的服務和人員可以訪問密鑰
- **分離環境權限**：開發環境的密鑰不應該能夠訪問生產資源

## 故障排除

### 環境變數未生效

**問題**：應用程序未能正確讀取環境變數

**解決方案**：

- 確保 Cloud Run 服務配置中正確設置了環境變數
- 檢查應用程序代碼是否正確讀取環境變數
- 確認密鑰名稱和大小寫是否一致

### Secret Manager 命名格式錯誤

**問題**：`Secret ID does not match the expected format [a-zA-Z_0-9]+`

**解決方案**：

- 確保密鑰名稱只包含字母、數字和下劃線
- 使用 `環境名稱_密鑰名稱` 格式 (如 `staging_MONGO_URL`) 而非 `環境名稱/密鑰名稱`
- 檢查腳本 `setup-secrets.sh` 是否正確設置密鑰名稱

### Secret Manager 權限問題

**問題**：Cloud Run 無法訪問 Secret Manager 中的密鑰

**解決方案**：

- 確保服務帳號有 `roles/secretmanager.secretAccessor` 角色
- 檢查密鑰名稱是否正確
- 確認密鑰版本是否存在（`latest` 或特定版本號）

### GitHub Actions 無法訪問密鑰

**問題**：GitHub Actions 工作流程中無法存取密鑰

**解決方案**：

- 確保密鑰名稱正確且區分大小寫
- 檢查 Workload Identity Federation 配置
- 驗證服務帳號是否有正確的 IAM 權限

---

## 參考資料

- [Google Cloud Secret Manager 文檔](https://cloud.google.com/secret-manager/docs)
- [GitHub 使用 Secrets 和 Variables](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Cloud Run 環境變數和密鑰](https://cloud.google.com/run/docs/configuring/environment-variables)

---

本文檔由團隊維護，最後更新日期：2024-04-27
