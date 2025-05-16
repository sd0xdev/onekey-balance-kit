# Google Cloud Run 部署指南

本文檔提供將 OneKey Balance Kit 專案部署到 Google Cloud Run 的完整指南，包括環境設置、服務配置、CI/CD 流程和故障排除。

## 目錄

- [環境準備](#環境準備)
- [Google Cloud 專案設置](#google-cloud-專案設置)
- [Docker 配置](#docker-配置)
- [密鑰和環境變數管理](#密鑰和環境變數管理)
- [部署流程](#部署流程)
- [CI/CD 自動化](#cicd-自動化)
- [監控和日誌](#監控和日誌)
- [常見問題排解](#常見問題排解)

## 環境準備

### 安裝必要工具

1. **安裝 gcloud CLI**

   按照 [Google Cloud 官方文檔](https://cloud.google.com/sdk/docs/install) 安裝 gcloud CLI。

2. **安裝 Docker**

   訪問 [Docker 官網](https://www.docker.com/products/docker-desktop/) 下載並安裝 Docker Desktop。

### 設置 gcloud 配置

1. **登入 Google Cloud**

   ```bash
   gcloud auth login
   ```

2. **查看現有配置**

   ```bash
   gcloud config configurations list
   ```

3. **創建新配置**

   ```bash
   # 創建新配置
   gcloud config configurations create one-key-balance

   # 設定帳號
   gcloud config set account your-email@example.com

   # 設定專案 ID
   gcloud config set project one-key-balance-kit

   # 設定計算區域
   gcloud config set compute/region asia-east1
   ```

4. **啟用配置**

   ```bash
   gcloud config configurations activate one-key-balance
   ```

5. **驗證配置**

   ```bash
   gcloud config configurations list
   ```

## Google Cloud 專案設置

### 創建和設置專案

1. **創建新專案** (如果尚未存在)

   ```bash
   # 創建專案
   gcloud projects create one-key-balance-kit --name="OneKey Balance Kit"

   # 設置為當前專案
   gcloud config set project one-key-balance-kit
   ```

2. **啟用計費** (如果需要)

   ```bash
   gcloud billing projects link one-key-balance-kit --billing-account=YOUR_BILLING_ACCOUNT_ID
   ```

### 啟用必要的 API

我們可以使用自動化腳本啟用所有必要的 API，或者手動執行以下命令：

```bash
# 啟用 Cloud Run API
gcloud services enable run.googleapis.com

# 啟用 Artifact Registry API
gcloud services enable artifactregistry.googleapis.com

# 啟用 IAM API
gcloud services enable iam.googleapis.com

# 啟用 Secret Manager API
gcloud services enable secretmanager.googleapis.com

# 啟用 Cloud Build API
gcloud services enable cloudbuild.googleapis.com
```

### 自動化環境設置

我們提供了完整的自動化腳本來設置 Google Cloud 環境。這些腳本支持冪等性操作，即使您多次執行腳本或資源已存在，也不會導致錯誤。請按照以下步驟操作：

1. **設置環境變數**

   運行 `setup-vars.sh` 來設置必要的環境變數：

   ```bash
   # 運行環境變數設置腳本
   ./scripts/setup-vars.sh

   # 載入環境變數
   source .env.gcp
   ```

   腳本會引導您輸入：

   - Google Cloud 專案 ID
   - 部署區域
   - GitHub 使用者名稱和儲存庫名稱
   - 服務帳號名稱和其他配置

2. **設置 Google Cloud 環境**

   使用環境變數運行 `setup-gcp.sh`：

   ```bash
   # 運行 Google Cloud 設置腳本
   ./scripts/setup-gcp.sh
   ```

   此腳本支持冪等性，可以安全地多次執行。它會自動執行以下操作：

   - 啟用必要的 Google Cloud API
   - 創建 Artifact Registry 儲存庫（如存在則跳過）
   - 創建服務帳號並授予必要權限（如存在則跳過）
   - 設置 Workload Identity Federation（如存在則跳過）
   - 將 GitHub 儲存庫綁定到服務帳號
   - 輸出需要添加到 GitHub Secrets 的值

3. **設置密鑰管理**

   使用 `setup-secrets.sh` 腳本將環境變數上傳到 Secret Manager：

   ```bash
   # 使用 .env.example 作為模板上傳密鑰
   ./scripts/setup-secrets.sh .env.example

   # 或使用自定義環境檔案
   ./scripts/setup-secrets.sh .env.production
   ```

   腳本同樣支持冪等性，會：

   - 將每個環境變數作為密鑰上傳到 Secret Manager（如存在則更新）
   - 授予服務帳號存取權限（如已授權則跳過）
   - 輸出 GitHub Actions 工作流程的配置示例

### 關於冪等性

我們的腳本遵循[冪等性原則](https://cloud.google.com/blog/products/serverless/cloud-functions-pro-tips-building-idempotent-functions)，這意味著無論執行多少次，結果都是一致的。這對於 CI/CD 流程和自動化部署非常重要，因為：

- 可以安全地重複執行
- 不會因為資源已存在而失敗
- 支持增量更新和修復
- 確保配置的一致性

例如，如果您在執行 `setup-gcp.sh` 中途遇到網絡問題或權限問題，只需修復問題後重新執行腳本，它會繼續設置剩餘的資源，而不會嘗試重新創建已存在的資源。

## Docker 配置

### 多階段 Dockerfile

專案根目錄中的 `Dockerfile` 已配置為使用多階段構建，提供最佳的生產映像：

```dockerfile
FROM node:22-slim AS builder

WORKDIR /app

# 安裝 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 複製 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 複製 tsconfig 和 nest 配置
COPY tsconfig*.json nest-cli.json ./

# 安裝依賴
RUN pnpm install --frozen-lockfile

# 複製源代碼
COPY src/ ./src/

# 建置應用
RUN pnpm build

# 第二階段：運行環境
FROM node:22-slim AS runner

WORKDIR /app

# 安裝 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 非 root 用戶運行應用
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r nodejs && useradd -r -g nodejs nodejs

# 定義運行時環境變數
ENV NODE_ENV production

# 從建置階段複製必要文件
COPY --from=builder --chown=nodejs:nodejs /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# 使用非 root 用戶
USER nodejs

# 使用 dumb-init 處理信號
ENTRYPOINT ["dumb-init", "--"]

# 默認命令
CMD ["node", "dist/main"]

# 暴露應用端口
EXPOSE 3000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

### Docker 忽略文件

`.dockerignore` 文件確保不必要的文件不會包含在 Docker 映像中：

```
# 源碼控制
.git
.github
.gitignore

# 開發環境
.vscode
.cursor
.idea
.editorconfig
.nvmrc
.node-version

# Node.js
node_modules
npm-debug.log
yarn-debug.log
yarn-error.log
pnpm-debug.log

# 建置輸出
dist
build
coverage

# 測試
test
coverage
*.spec.ts
*.test.ts
jest.config.js

# 部署相關
Dockerfile
.dockerignore
*.md
LICENSE
docker-compose*.yml
cloud-run-service.yaml

# 開發工具配置
.prettierrc
.lintstagedrc
.husky
eslint.config.mjs

# 其他
*.log
*.env*
!.env.example
```

## 密鑰和環境變數管理

### 設置 Secret Manager

使用 `setup-secrets.sh` 腳本將環境變數和密鑰上傳到 Google Cloud Secret Manager：

```bash
# 設置服務帳號名稱
export SERVICE_ACCOUNT_NAME=github-actions-runner
export PROJECT_ID=one-key-balance-kit

# 上傳密鑰
./scripts/setup-secrets.sh .env.example
```

### 密鑰類型

我們將環境變數分為兩類：

1. **非敏感資訊**：直接在 GitHub Actions 工作流程中設置

   - `NODE_ENV`
   - `SERVICE_NAME`
   - `API_BASE_URL`
   - `CORS_ORIGIN`
   - `CACHE_TTL`

2. **敏感資訊**：存儲在 Secret Manager 中
   - `REDIS_CONNECTION_STRING`
   - `MONGO_CONNECTION_STRING`
   - `ALCHEMY_API_KEY`
   - `QUICKNODE_API_KEY`
   - `API_SECRET_KEY`

## 部署流程

### 手動部署

如果需要手動部署，可以使用以下命令：

```bash
# 構建 Docker 映像
docker build -t asia-east1-docker.pkg.dev/one-key-balance-kit/one-key-balance-kit/api:latest .

# 認證到 Google Artifact Registry
gcloud auth configure-docker asia-east1-docker.pkg.dev

# 推送映像
docker push asia-east1-docker.pkg.dev/one-key-balance-kit/one-key-balance-kit/api:latest

# 部署到 Cloud Run
gcloud run deploy one-key-balance-kit \
  --image=asia-east1-docker.pkg.dev/one-key-balance-kit/one-key-balance-kit/api:latest \
  --region=asia-east1 \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --cpu=1 \
  --memory=1Gi \
  --port=3000 \
  --set-env-vars=NODE_ENV=production
```

### 使用 Cloud Run Service YAML

我們也提供了 Cloud Run 服務的 YAML 配置，可以用它來部署：

```bash
# 替換映像 URL
sed "s|IMAGE_URL|asia-east1-docker.pkg.dev/one-key-balance-kit/one-key-balance-kit/api:latest|g" \
  cloud-run-service.yaml > cloud-run-service-updated.yaml

# 使用 YAML 配置部署
gcloud run services replace cloud-run-service-updated.yaml --region=asia-east1
```

## CI/CD 自動化

我們使用 GitHub Actions 實現 CI/CD 自動化，配置文件位於 `.github/workflows/` 目錄下。

### 生產環境部署

`.github/workflows/gcp-deploy.yml` 在代碼推送到 `main` 分支時觸發，部署到生產環境。

### 開發環境部署

`.github/workflows/gcp-deploy-dev.yml` 在代碼推送到 `develop` 分支時觸發，部署到開發環境。

### GitHub Repository 設置

在 GitHub Repository 中設置以下 Secrets 和 Variables：

1. **Secrets**:

   - `GCP_PROJECT_ID`: Google Cloud 專案 ID
   - `GCP_SERVICE_ACCOUNT`: 服務帳號電子郵件
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`: Workload Identity 提供者

2. **Variables**:
   - `GCP_REGION`: 部署區域 (例如 `asia-east1`)
   - `DEV_API_BASE_URL`: 開發環境 API 基礎 URL
   - `PROD_API_BASE_URL`: 生產環境 API 基礎 URL

## 監控和日誌

### 查看日誌

```bash
# 查看 Cloud Run 服務日誌
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=one-key-balance-kit" --limit=10
```

### 監控服務

1. 訪問 Google Cloud Console > Cloud Run > 服務
2. 點擊您的服務可以查看指標、修訂版本和日誌

## 常見問題排解

### 部署失敗

1. **映像構建失敗**

   - 檢查 Dockerfile 是否有語法錯誤
   - 確保所有依賴都正確安裝

2. **認證問題**

   - 確保 Workload Identity Federation 正確設置
   - 檢查服務帳號是否有適當的權限

3. **環境變數問題**

   - 檢查是否缺少必要的環境變數
   - 確保密鑰已正確設置在 Secret Manager 中

4. **服務啟動失敗**
   - 檢查 Cloud Run 服務日誌
   - 確保健康檢查端點正確響應

### 性能優化

1. **調整資源限制**

   - 調整 CPU 和內存分配
   - 優化最小和最大實例設置

2. **快取策略**
   - 使用 Redis 快取改善響應時間
   - 配置適當的 CDN 設置

---

本文檔由團隊維護，最後更新日期：2023-05-12
