# OneKeyBalanceKit

[![CI](https://github.com/sd0xdev/onekey-balance-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sd0xdev/onekey-balance-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-22.x-brightgreen.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11.x-red.svg)](https://nestjs.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

<p align="center">
  <img src="https://raw.githubusercontent.com/sd0xdev/onekey-balance-kit/main/docs/assets/logo.png" alt="OneKeyBalanceKit Logo" width="200">
</p>

> 一個高性能、可擴展的多鏈資產餘額查詢服務，支持以太坊和 Solana 區塊鏈，提供統一的 API 接口來查詢地址的原生代幣、ERC-20/SPL 代幣和 NFT 資產。

## 📖 目錄

- [特性](#-特性)
- [技術架構](#-技術架構)
- [快速開始](#-快速開始)
- [API 參考](#-api-參考)
- [項目規範與指南](#-項目規範與指南)
- [詳細文檔](#-詳細文檔)
- [部署指南](#-部署指南)
- [開發指南](#-開發指南)
- [貢獻指南](#-貢獻指南)
- [常見問題](#-常見問題)
- [授權協議](#-授權協議)

## ✨ 特性

- **統一多鏈支持**：支持以太坊 (EVM) 和 Solana，統一資產數據格式與查詢介面
- **高效能快取系統**：三層快取架構確保高性能和低延遲
  - Cloudflare Edge 快取：地理位置分散，低延遲訪問
  - Redis 快取層：30-60秒快速存取
  - MongoDB 持久層：歷史數據分析與回溯
- **實時數據更新**：通過 Webhook 機制實現數據即時更新
- **高可用與可擴展**：微服務架構，支持水平擴展
- **完整類型支持**：使用 TypeScript 開發，100% 類型覆蓋
- **完善的錯誤處理**：標準化的錯誤碼與提示信息
- **全面的測試覆蓋**：單元測試、集成測試、E2E 測試

## 🔄 技術架構

### 系統架構圖

```
用戶請求 → Cloudflare CDN → NestJS API → 區塊鏈數據提供者
                              ↑    ↓
                           Redis ← MongoDB
                              ↑
                       Webhook 事件觸發器
```

### 核心技術棧

- **後端框架**：NestJS (Node.js)
- **數據庫**：MongoDB (資產數據持久存儲)
- **快取系統**：Redis (高速查詢快取)
- **區塊鏈交互**：Alchemy SDK, Ethers.js, @solana/web3.js
- **API 文檔**：Swagger/OpenAPI
- **CI/CD**：GitHub Actions
- **容器化**：Docker & Docker Compose
- **監控**：Prometheus & Grafana (可選配置)

## 🚀 快速開始

### 前置需求

- Node.js >= 22.x
- Docker & Docker Compose (推薦)
- MongoDB 4.x+ (如不使用 Docker)
- Redis 6.x+ (如不使用 Docker)
- Alchemy API 密鑰 (以太坊和 Solana)

### 使用 Docker Compose 部署

1. 克隆儲存庫：

```bash
git clone https://github.com/sd0xdev/onekey-balance-kit.git
cd onekey-balance-kit
```

2. 複製並配置環境變數：

```bash
cp .env.example .env
# 編輯 .env 文件並填入必要的 API 密鑰和配置
```

3. 使用 Docker Compose 啟動服務：

```bash
docker-compose up -d
```

服務將在 `http://localhost:3000` 運行。

### 手動安裝

1. 克隆儲存庫：

```bash
git clone https://github.com/sd0xdev/onekey-balance-kit.git
cd onekey-balance-kit
```

2. 複製環境配置文件：

```bash
cp .env.example .env.development
# 編輯 .env.development 並填入你的配置
```

3. 安裝依賴：

```bash
npm install
# 或
pnpm install
```

4. 啟動開發伺服器：

```bash
npm run start:dev
# 或
pnpm start:dev
```

5. 構建生產版本：

```bash
npm run build
npm run start:prod
```

## 📚 API 參考

### 資產餘額查詢

```
GET /v1/balances/:chain/:address
```

**路徑參數**

- `:chain` - 區塊鏈類型，支持 `eth` 或 `sol`
- `:address` - 區塊鏈地址

**查詢參數**

- `provider` (可選) - 指定區塊鏈數據提供者 (例如: `alchemy`, `quicknode`)
- `testnet` (可選) - 使用測試網絡 (布爾值, 默認: `false`)

**響應格式**

```json
{
  "chainId": 1,
  "native": {
    "symbol": "ETH",
    "decimals": 18,
    "balance": "0.832554",
    "usd": 2436.12
  },
  "fungibles": [
    {
      "mint": "0x6b1754...",
      "symbol": "DAI",
      "decimals": 18,
      "balance": "120.5",
      "usd": 120.47
    }
  ],
  "nfts": [
    {
      "mint": "0xabc...",
      "tokenId": "1234",
      "collection": "Pudgy Penguins",
      "name": "Pudgy #1234",
      "image": "ipfs://..."
    }
  ],
  "updatedAt": 1715678900
}
```

### 地址驗證

```
GET /v1/chains/:chain/validate/:address
```

**路徑參數**

- `:chain` - 區塊鏈類型，支持 `eth` 或 `sol`
- `:address` - 要驗證的地址

**響應格式**

```json
{
  "isValid": true
}
```

### 完整 API 文檔

啟動服務後訪問 Swagger 文檔：`http://localhost:3000/api-docs`

## 📋 項目規範與指南

為確保程式碼品質和一致性，專案提供了以下規範與指南：

- [區塊鏈服務模組](.cursor/rules/blockchain.mdc)：區塊鏈服務架構與實現指南
- [區塊鏈提供者](.cursor/rules/blockchain-providers.mdc)：區塊鏈提供者的實現與使用方式
- [快取策略](.cursor/rules/caching-strategy.mdc)：多層快取實現與最佳實踐
- [ESLint 配置指南](.cursor/rules/eslint-config.mdc)：程式碼風格與質量規範
- [Nest.js 最佳實踐](.cursor/rules/nestjs-patterns.mdc)：Nest.js 框架使用指南
- [專案結構](.cursor/rules/project-structure.mdc)：專案目錄結構與模組說明

## 📚 詳細文檔

本專案提供了以下詳細文檔，幫助您理解部署流程與系統架構：

- [Workload Identity Federation 設置指南](docs/workload-identity-federation-setup.md)：實現 GitHub Actions 與 Google Cloud 的無密鑰安全授權
- [密鑰與環境變數管理](docs/secrets-and-env-vars-management.md)：安全管理專案敏感配置的最佳實踐
- [Google Cloud 部署指南](docs/gcp-deployment-guide.md)：在 Google Cloud Run 上部署服務的完整步驟
- [架構設計與技術選型](docs/working-draft.md)：系統架構、技術棧選擇與成本評估文檔

## 🚢 部署指南

### 生產環境部署

推薦使用 Docker 進行生產部署：

```bash
# 構建生產 Docker 鏡像
docker build -t onekey-balance-kit:prod .

# 運行容器
docker run -p 3000:3000 --env-file .env.production onekey-balance-kit:prod
```

### Webhook 設置

在 Alchemy Dashboard 中設置 Webhook，指向：

```
POST https://你的域名/v1/webhook
```

並確保添加正確的安全頭部 `x-webhook-signature` 以驗證請求有效性。

### 負載均衡與高可用

對於生產環境，建議：

1. 使用 Kubernetes 或類似系統進行容器編排
2. 設置多個服務實例並配置負載均衡
3. 使用分布式 Redis 叢集作為快取層
4. 為 MongoDB 配置副本集提高資料可靠性

## 💻 開發指南

### 分支策略

- `main` - 穩定版本分支
- `develop` - 開發分支
- `feature/*` - 功能分支
- `bugfix/*` - 錯誤修復分支
- `release/*` - 發布準備分支

### 測試

```bash
# 運行單元測試
npm run test

# 運行帶覆蓋率報告的測試
npm run test:cov

# 運行 E2E 測試
npm run test:e2e
```

### CI/CD 流程

本項目使用 GitHub Actions 自動化測試和構建流程：

- **代碼檢查**：ESLint + Prettier
- **單元測試**：Jest
- **集成測試**：帶測試容器的 NestJS 測試
- **構建檢查**：驗證構建成功
- **Docker 鏡像構建**：用於部署

詳細配置參見 [CI 工作流程](.github/workflows/ci.yml)。

## 👥 貢獻指南

我們歡迎各種形式的貢獻！請參考以下步驟：

1. Fork 儲存庫
2. 創建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 創建 Pull Request

請確保：

- 所有測試通過
- 遵循代碼風格指南
- 更新相關文檔
- 提供充分的描述說明變更的目的和影響

## ❓ 常見問題

**Q: 如何擴展支持新的區塊鏈？**

A: 請參考[區塊鏈服務模組](.cursor/rules/blockchain.mdc)文檔，實現新的區塊鏈服務類和提供者。

**Q: 系統能處理的最大並發請求數是多少？**

A: 這取決於硬件配置。在標準配置下，單實例可處理約 1000 QPS，使用快取後可達 5000+ QPS。

**Q: 如何配置自定義區塊鏈數據提供者？**

A: 請參考[區塊鏈提供者](.cursor/rules/blockchain-providers.mdc)文檔，實現自定義提供者類。

## 📜 授權協議

本項目基於 MIT 授權協議發布。完整授權條款請參見 [LICENSE](LICENSE) 文件。

## CI/CD 部署配置

此專案使用 GitHub Actions 進行持續整合和部署到 Google Cloud Run。

### 前置要求

1. Google Cloud 專案
2. GitHub 倉庫權限
3. gcloud CLI 工具

### 初始設置

在 Google Cloud 中設置所需資源：

```bash
# 複製此倉庫
git clone <repository-url>
cd one-key-balance-kit

# 設置環境變數
export PROJECT_ID=your-gcp-project-id
export REGION=asia-east1

# 執行設置腳本
./scripts/setup-gcp.sh
```

### GitHub Secrets 和變數設置

在你的 GitHub 倉庫中，添加以下 secrets：

- `GCP_PROJECT_ID`: 你的 Google Cloud 專案 ID
- `GCP_SERVICE_ACCOUNT`: 服務帳號電子郵件 (例如 `github-actions-runner@your-project-id.iam.gserviceaccount.com`)
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: Workload Identity 提供者 (從設置腳本輸出中獲取)

添加以下變數：

- `GCP_REGION`: 部署區域 (例如 `asia-east1`)

### 部署流程

1. 當代碼推送到 `main` 分支時，GitHub Actions 會自動觸發部署。
2. 工作流程執行以下步驟：
   - 檢查代碼
   - 使用 Workload Identity Federation 進行身份驗證
   - 構建 Docker 映像
   - 掃描映像中的漏洞
   - 將映像推送到 Artifact Registry
   - 部署到 Cloud Run

### 手動觸發部署

可以在 GitHub Actions 頁面手動觸發部署流程。

### 版本管理

- 每個部署都會使用 Git SHA 作為容器標籤
- 最新部署也會被標記為 `latest`

### 安全最佳實踐

- 使用 Workload Identity Federation 而非服務帳號金鑰
- 遵循最小權限原則設置服務帳號
- 容器映像的自動漏洞掃描
- 使用多階段建構來減少容器映像大小
- 容器中使用非 root 使用者

### 環境變數與密鑰管理

本專案使用 Google Cloud Secret Manager 來安全管理敏感資訊。以下是設置環境變數和密鑰的步驟：

#### 設置機密資訊到 Secret Manager

1. 準備一個環境變數檔案（例如 `.env.production` 或 `.env.development`）
2. 使用提供的腳本將環境變數上傳到 Secret Manager：

```bash
# 設置環境變數
export PROJECT_ID=your-gcp-project-id
export SERVICE_ACCOUNT_NAME=github-actions-runner

# 使用預設 .env.example 檔案
./scripts/setup-secrets.sh

# 或指定特定環境檔案
./scripts/setup-secrets.sh .env.production
```

#### GitHub Actions 中的環境變數

在 GitHub Actions 工作流程中，環境變數分為兩類：

1. **非敏感資訊**：直接使用 `env_vars` 在工作流程中設置
2. **敏感資訊**：通過 `secrets` 從 Secret Manager 引用

例如：

```yaml
# 非敏感資訊
env_vars: |
  NODE_ENV=production
  SERVICE_NAME=one-key-balance-kit

# 敏感資訊（從 Secret Manager 獲取）
secrets: |
  REDIS_CONNECTION_STRING=REDIS_CONNECTION_STRING:latest
  MONGO_CONNECTION_STRING=MONGO_CONNECTION_STRING:latest
```

#### GitHub Repository 設置

在 GitHub 倉庫中設置以下變數：

1. **Repository Variables**（在 Settings > Secrets and variables > Actions > Variables）：

   - `GCP_REGION`: 部署區域（例如 `asia-east1`）
   - `DEV_API_BASE_URL`: 開發環境 API 基礎 URL
   - `PROD_API_BASE_URL`: 生產環境 API 基礎 URL

2. **Repository Secrets**（在 Settings > Secrets and variables > Actions > Secrets）：
   - `GCP_PROJECT_ID`: Google Cloud 專案 ID
   - `GCP_SERVICE_ACCOUNT`: 服務帳號
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`: Workload Identity 提供者

## 部署配置

本專案使用單一模板檔案進行 Cloud Run 服務配置，並在部署時根據環境動態生成實際配置：

- `cloud-run-service.template.yaml` - 服務配置模板

### 部署方式

有兩種部署方式：

#### 1. 使用 GitHub Actions (CI/CD)

統一的 GitHub Actions 工作流程會自動在以下情況觸發部署：

- 推送到 `main` 分支 - 部署到生產環境
- 推送到 `develop` 分支 - 部署到開發環境

也可以在 GitHub 上手動觸發工作流程並選擇目標環境。

#### 2. 手動部署

使用以下命令手動部署：

```bash
# 生成配置文件 - 生產環境
cat cloud-run-service.template.yaml | sed \
  -e "s|\${ENV_SUFFIX}||g" \
  -e "s|\${ENVIRONMENT}|production|g" \
  -e "s|\${MAX_INSTANCES}|10|g" \
  -e "s|\${REGION}|asia-east1|g" \
  -e "s|\${PROJECT_ID}|YOUR_PROJECT_ID|g" \
  -e "s|\${IMAGE_SUFFIX}||g" \
  -e "s|\${IMAGE_TAG}|latest|g" \
  -e "s|\${NODE_ENV}|production|g" \
  -e "s|\${LOG_LEVEL}||g" \
  -e "s|\${API_BASE_URL}|https://api.example.com|g" \
  -e "s|\${CORS_ORIGIN}|https://app.example.com|g" \
  -e "s|\${SECRET_PREFIX}|production|g" \
  > cloud-run-service-generated.yaml

# 部署生成的配置
gcloud run services replace cloud-run-service-generated.yaml --region=asia-east1

# 對於開發環境，只需更改替換變數的值
```

### 環境變數與密鑰

所有環境變數和密鑰引用都在模板檔案中使用佔位符定義，部署前會動態替換：

- `${ENV_SUFFIX}`: 環境後綴 (生產為空，開發為 `-dev`)
- `${ENVIRONMENT}`: 環境名稱 (`production` 或 `staging`)
- `${MAX_INSTANCES}`: 最大實例數 (生產為 `2`，開發為 `1`)
- `${NODE_ENV}`: Node.js 環境 (`production` 或 `development`)
- `${SECRET_PREFIX}`: 密鑰前綴 (`production` 或 `staging`)

使用 `scripts/setup-secrets.sh` 腳本設置密鑰。

### 本地測試配置生成

在推送到 GitHub 觸發 CI/CD 之前，可以在本地測試配置模板的替換是否正確：

```bash
# 測試生成開發環境配置
cat cloud-run-service.template.yaml | sed \
  -e "s|\${ENV_SUFFIX}|-dev|g" \
  -e "s|\${ENVIRONMENT}|staging|g" \
  -e "s|\${MAX_INSTANCES}|5|g" \
  -e "s|\${REGION}|asia-east1|g" \
  -e "s|\${PROJECT_ID}|你的專案ID|g" \
  -e "s|\${IMAGE_SUFFIX}|-dev|g" \
  -e "s|\${IMAGE_TAG}|latest|g" \
  -e "s|\${NODE_ENV}|development|g" \
  -e "s|\${LOG_LEVEL}|debug|g" \
  -e "s|\${API_BASE_URL}|https://api-dev.example.com|g" \
  -e "s|\${CORS_ORIGIN}|\*|g" \
  -e "s|\${SECRET_PREFIX}|staging|g" \
  > test-generated.yaml

# 查看生成的配置
cat test-generated.yaml

# 檢查配置是否有語法錯誤
gcloud run services replace test-generated.yaml --region=asia-east1 --dry-run

# 完成檢查後刪除測試配置
rm test-generated.yaml
```

這種測試方法可以確保模板替換正常工作，避免在 CI/CD 管道中遇到意外問題。特別是當你修改模板文件或添加新的環境變數時，這種預先測試尤為重要。

此方法的優點：

- 只需維護一份模板檔案
- 環境差異通過變數參數化
- 自動化部署流程處理環境差異
- 減少重複配置的風險
- 更容易擴展到新環境

---

<p align="center">Made with ❤️ by <a href="https://github.com/sd0xdev">SD0</a></p>
