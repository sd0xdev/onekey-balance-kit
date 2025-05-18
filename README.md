# OneKeyBalanceKit

[![CI](https://github.com/sd0xdev/onekey-balance-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sd0xdev/onekey-balance-kit/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/sd0xdev/onekey-balance-kit/graph/badge.svg?token=159I3Z37RP)](https://codecov.io/gh/sd0xdev/onekey-balance-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-22.x-brightgreen.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11.x-red.svg)](https://nestjs.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

<p align="center">
  <img src="https://raw.githubusercontent.com/sd0xdev/onekey-balance-kit/main/docs/assets/logo.png" alt="OneKeyBalanceKit Logo" width="200">
</p>

> 一個高性能、可擴展的多鏈資產餘額查詢服務，支持以太坊和 Solana 區塊鏈，提供統一的 API 接口來查詢地址的原生代幣、ERC-20/SPL 代幣和 NFT 資產。

## 📑 目錄

- [✨ 特性](#-特性)
- [🔄 技術架構](#-技術架構)
- [🚀 快速開始](#-快速開始)
- [📚 API 參考](#-api-參考)
- [📖 文檔](#-文檔)
- [💻 開發與貢獻](#-開發與貢獻)
- [🚢 部署](#-部署)
- [❓ 常見問題](#-常見問題)
- [🔄 多鏈支持](#-多鏈支持)
- [📜 授權協議](#-授權協議)
- [RoadMap](#roadmap)

## ✨ 特性

- **統一多鏈支持**：支持以太坊（EVM 兼容鏈）和 Solana，統一資產數據格式與查詢介面
- **高效能快取系統**：三層快取架構確保高性能和低延遲

  - Cloudflare Edge 快取：地理位置分散，低延遲訪問

  - Redis 快取層：30-60秒快速存取
  - MongoDB 持久層：歷史數據分析與回溯

- **實時數據更新**：通過 Webhook 機制實現數據即時更新
  - 支援 Alchemy 的地址活動監控
  - 自動清理過期監控地址
  - 智能快取失效，避免不必要的數據請求
- **高可用與可擴展**：微服務架構，支持水平擴展
- **完整類型支持**：使用 TypeScript 開發，100% 類型覆蓋
- **完善的錯誤處理**：標準化的錯誤碼與提示信息
- **全面的測試覆蓋**：單元測試與完整的覆蓋率報告

## 🔄 技術架構

### 系統架構

```
用戶請求 → Cloudflare CDN → NestJS API → 區塊鏈數據提供者
                              ↑    ↓
                           Redis ← MongoDB
                              ↑
                       Webhook 事件觸發器
```

### 核心技術棧

| 類別       | 技術                                    |
| ---------- | --------------------------------------- |
| 後端框架   | NestJS (Node.js)                        |
| 數據庫     | MongoDB                                 |
| 快取系統   | Redis                                   |
| 區塊鏈交互 | Alchemy SDK, Ethers.js, @solana/web3.js |
| API 文檔   | Swagger/OpenAPI                         |
| CI/CD      | GitHub Actions                          |
| 容器化     | Docker & Docker Compose                 |
| 監控       | Prometheus & Grafana (可選)             |

## 🚀 快速開始

### 前置需求

- Node.js >= 22.x
- Docker & Docker Compose (推薦)
- MongoDB 4.x+ (如不使用 Docker)
- Redis 6.x+ (如不使用 Docker)
- Alchemy API 密鑰 (以太坊和 Solana)

### 使用 Docker Compose 部署

```bash
# 1. 克隆儲存庫
git clone https://github.com/sd0xdev/onekey-balance-kit.git
cd onekey-balance-kit

# 2. 設定環境變數
cp .env.example .env
# 編輯 .env 文件並填入必要的 API 密鑰和配置

# 3. 啟動服務
docker-compose up -d
```

服務將在 `http://localhost:3000` 運行。

### 手動安裝

```bash
# 1. 克隆儲存庫
git clone https://github.com/sd0xdev/onekey-balance-kit.git
cd onekey-balance-kit

# 2. 設定環境變數
cp .env.example .env.development
# 編輯 .env.development 並填入必要配置

# 3. 安裝依賴
pnpm install

# 4. 啟動開發伺服器
pnpm start:dev

# 5. 或構建並運行生產版本
pnpm build
pnpm start:prod
```

## 📚 API 參考

### 主要端點

| 端點                                          | 說明               |
| --------------------------------------------- | ------------------ |
| `GET /v1/api/balances/:chain/:address`        | 查詢地址資產餘額   |
| `GET /v1/api/chains/:chain/validate/:address` | 驗證區塊鏈地址格式 |
| `POST /v1/api/webhook`                        | Webhook 接收端點   |

### 餘額查詢示例

```
GET /v1/api/balances/eth/0x1234...5678
```

**查詢參數**

- `provider`: 指定區塊鏈數據提供者 (可選)
- `testnet`: 使用測試網絡 (可選，默認為 false)

**響應**

```json
{
  "chainId": 1,
  "native": {
    "symbol": "ETH",
    "decimals": 18,
    "balance": "0.832554",
    "usd": 2436.12
  },
  "fungibles": [...],
  "nfts": [...],
  "updatedAt": 1715678900
}
```

**完整 API 文檔**：啟動服務後訪問 `http://localhost:3000/api-docs`

## 📖 文檔

### 項目規範與指南

- [區塊鏈服務模組](.cursor/rules/blockchain.mdc)：服務架構與實現指南
- [區塊鏈提供者](.cursor/rules/blockchain-providers.mdc)：提供者實現與使用方式
- [快取策略](.cursor/rules/caching-strategy.mdc)：多層快取實現與最佳實踐
- [ESLint 配置](.cursor/rules/eslint-config.mdc)：程式碼風格與質量規範
- [Nest.js 最佳實踐](.cursor/rules/nestjs-patterns.mdc)：框架使用指南
- [專案結構](.cursor/rules/project-structure.mdc)：目錄結構與模組說明
- [Webhook 機制](.cursor/rules/webhook.mdc)：區塊鏈地址監控與事件處理

### 部署與架構文檔

- [Workload Identity Federation 設置](docs/workload-identity-federation-setup.md)
- [密鑰與環境變數管理](docs/secrets-and-env-vars-management.md)
- [Google Cloud 部署指南](docs/gcp-deployment-guide.md)
- [架構設計與技術選型](docs/working-draft.md)

## 💻 開發與貢獻

### 分支策略

- `main` - 穩定版本分支
- `develop` - 開發分支
- `feature/*` - 功能分支
- `bugfix/*` - 錯誤修復分支
- `release/*` - 發布準備分支

### 測試

```bash
# 運行單元測試
pnpm test

# 運行帶覆蓋率報告的測試
pnpm test:cov
```

### 貢獻流程

1. Fork 儲存庫
2. 創建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 創建 Pull Request

請確保：

- 所有測試通過
- 遵循代碼風格指南
- 更新相關文檔
- 提供充分的描述說明變更

## 🚢 部署

### 生產環境部署選項

1. **Docker 部署**

   ```bash
   docker build -t onekey-balance-kit:prod .
   docker run -p 3000:3000 --env-file .env.production onekey-balance-kit:prod
   ```

2. **Google Cloud Run 部署**
   - 使用專案提供的 CI/CD 自動化流程
   - 詳細配置請參見 [Google Cloud 部署指南](docs/gcp-deployment-guide.md)

### 高可用配置建議

- 使用 Kubernetes 或類似系統進行容器編排
- 配置多實例與負載均衡
- 使用分布式 Redis 叢集作為快取層
- 為 MongoDB 配置副本集提高數據可靠性

## ❓ 常見問題

**Q: 如何擴展支持新的區塊鏈？**

A: 參考[區塊鏈服務模組](.cursor/rules/blockchain.mdc)文檔，實現新的區塊鏈服務和提供者。EVM 兼容鏈可以繼承抽象基類，只需少量代碼。

**Q: 系統能處理的最大並發請求數是多少？**

A: 標準配置下，單實例可處理約 1000 QPS，使用快取後可達 5000+ QPS。具體取決於硬件配置。

**Q: 如何配置自定義區塊鏈數據提供者？**

A: 參考[區塊鏈提供者](.cursor/rules/blockchain-providers.mdc)文檔，實現自定義提供者類。

## 🔄 多鏈支持

本專案支援多條EVM兼容鏈與Solana，具有以下核心特點：

- **抽象基類設計**：`AbstractEvmChainService` 提供統一邏輯，新鏈只需少量代碼
- **中央化元數據**：鏈配置統一管理於 `src/chains/constants/evm-chains.ts`
- **環境變量控制**：通過 `ENABLE_CHAINS=ETH,POLY,BSC` 設定啟用的鏈
- **統一API接口**：所有鏈使用相同路徑格式 `/v1/balances/:chain/:address`

支援新增EVM鏈的完整指南請參考 [區塊鏈服務模組](.cursor/rules/blockchain.mdc) 文檔。

## 📜 授權協議

本項目基於 MIT 授權協議發布。完整授權條款請參見 [LICENSE](LICENSE) 文件。

---

## RoadMap

### 1. 基礎鏈接層 (Core & Provider)

- [x] ETH Mainnet MVP
- [x] 多鏈抽象（EVM／L2／BTC／Solana／Discovery）
  - [x] 服務註冊 / 發現 / 路由
  - [x] Price Provider
    - [x] Mock Price Provider
    - [ ] OKX Price Provider
  - [x] EVM 鏈抽象
    - [x] Base
    - [x] Optimism
    - [x] Polygon
    - [ ] Avalanche
    - [x] BSC
    - [ ] Arbitrum
    - [x] 測試網
      - [x] ETH Sepolia
  - [x] Solana
    - [x] Mainnet
    - [x] Testnet
  - [ ] Bitcoin
- [x] Provider 抽象
  - [x] 服務註冊 / 發現 / 路由
  - [x] Alchemy
    - [x] EVM Base
    - [x] Solana
  - [x] QuickNode
    - [x] Ethereum

### 2. 資料層 (Cache & Storage)

- [x] Redis
- [x] MongoDB （Snapshot 歷史）
- [x] 快取策略
  - [x] 三層快取
    - [ ] Edge 快取
    - [x] Redis 快取（熱快取）
    - [x] MongoDB 快取（溫快取）
  - [x] 快取失效
- [ ] 資產走勢（利用過期快取組合 OHLC）
- [ ] 價格整合（串接行情 API，計算 Portfolio 市值）

### 3. API 層 (Query Interface)

- [x] `/balances/:chain/:address` 查詢資產組合
- [x] `/chains` 列出支援鏈
- [x] `/chains/:chain/validate/:address` 驗證地址格式
- [x] `/webhook` 接收 Webhook 事件

### 4. 事件與通知 (Events & Notifications)

- [x] 事件通知中心（業務操作解耦）
- [x] Webhook 機制
- [x] SSE 推送：快取失效／資產變動通知
- [ ] 精細化快取失效：鏈上活動
- [ ] 精細化快取失效：資產變動
- [ ] 精細化快取失效：資產走勢

### 5. 測試

- [x] 單元測試
- [x] 覆蓋率報告
- [x] E2E 測試

### 6. DevOps & CI/CD

- [x] GitHub Actions （CI Pipeline）
  - [x] lint
  - [x] 單元測試
  - [x] 覆蓋率報告
  - [x] 部署
  - [x] Release Deployment
- [x] Docker （多階段 Build）
- [x] Docker Compose （本地開發）
  - [ ] 本地運行
- [x] Google Cloud — 自動化環境建置腳本
- [x] Google Cloud — Secret Manager 整合
- [x] Google Cloud — Cloud Run 部署
- [x] Google Cloud — Workload Identity Federation （OIDC）
- [x] Local Webhook 配置

### 7. 前端 Dashboard

- [ ] 資產總覽 Dashboard
- [ ] 自定義 Provider API Key
- [ ] 圖表／走勢視覺化（待後端資料完成後對接）
- [ ] OpenAPI 文件

### 8. 觀測

- [ ] 性能觀測
- [ ] 全鏈路追蹤
- [ ] 告警

### 9. 其他

- [x] GCP 部署指南
- [x] 環境變數指引
- [x] Webhook Debugger 指南
- [x] 架構設計工作底稿
- [x] workload identity federation 指南
- [x] [專案設計指南](.cursor/rules)

<p align="center">Made with ❤️ by <a href="https://github.com/sd0xdev">SD0</a></p>
