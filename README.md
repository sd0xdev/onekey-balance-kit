# OneKeyBalanceKit

[![CI](https://github.com/sd0xdev/onekey-balance-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sd0xdev/onekey-balance-kit/actions/workflows/ci.yml)

OneKeyBalanceKit 是一個多鏈資產餘額查詢服務，支持以太坊和 Solana 區塊鏈，提供統一的 API 接口來查詢地址的代幣和 NFT 資產。

## 架構特點

- **雙鏈支持**：以太坊 (EVM) 和 Solana，統一輸出格式
- **三層快取**：Cloudflare Edge → Redis 30-60秒 → MongoDB 歷史快照
- **實時更新**：通過 Alchemy Webhook 觸發快取失效
- **高效查詢**：利用 Alchemy SDK 的高階 API 簡化數據獲取

## 快速開始

### 環境配置

1. 複製 `.env.example` 到 `.env.development` 並填入你的 API Key：

```
ALCHEMY_API_KEY_ETH=your-eth-key
ALCHEMY_API_KEY_SOL=your-sol-key
REDIS_URL=redis://localhost:6379
MONGO_URL=mongodb://localhost:27017/one-key-balance-kit
```

2. 安裝依賴：

```bash
npm install
# 或
pnpm install
```

3. 啟動開發伺服器：

```bash
npm run start:dev
# 或
pnpm start:dev
```

### API 使用

#### 查詢餘額

```
GET /v1/balances/:chain/:address
```

- `:chain` - 鏈類型，支持 `eth` 或 `sol`
- `:address` - 錢包地址

**範例請求**

```
curl http://localhost:3000/v1/balances/eth/0x123...
```

**範例響應**

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

## 開發說明

- 主要技術棧：NestJS, Alchemy SDK, Redis, MongoDB
- 模塊化設計：支持輕鬆擴展到更多區塊鏈

## CI/CD

本項目使用 GitHub Actions 自動化測試和構建流程：

- **Lint 檢查**：確保代碼風格一致性
- **單元測試**：運行單元測試確保功能正確性
- **自動構建**：驗證代碼能否成功構建
- **環境模擬**：CI 環境集成了 Redis 和 MongoDB 服務

查看 [CI 工作流程](.github/workflows/ci.yml) 了解更多詳情。

## Webhook 設置

在 Alchemy Dashboard 中設置 Webhook，指向：

```
POST https://你的域名/v1/webhook
```

並確保添加正確的安全頭部 `x-webhook-signature`。

## 授權

MIT © 2025 SD0
