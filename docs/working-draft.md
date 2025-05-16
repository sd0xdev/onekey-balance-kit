# OneKeyBalanceKit — Working Draft (v2)

---

## 0. 摘要

- **支援鏈**：Ethereum + Solana（皆走 Alchemy）
- **三層快取**：Cloudflare Edge → Redis 30‑60 s → MongoDB 快照／歷史
- **限流策略**：Alchemy Free 100 M CU/月；用盡回 `429`，前端可帶 `X‑Alchemy-Token`
- **專案結構**：單 Nest App，`src/` 下拆 core / chains / providers，後續擴充只增子資料夾即可

---

## 1. 架構鳥瞰

```other
┌───────────────┐     Webhook     ┌─────────────┐
│   Alchemy     │ ───────────────▶│ Webhook      │
│ (EVM + SOL)   │                 │  Worker      │
└───────────────┘                 └──────┬──────┘
        ▲   REST HTTPS                     │ Redis.DEL
        │                                  ▼
Client  │ GET /v1/balances             ┌──────────┐
────────┼─────────────────────────────▶│  API      │
        │                             │ Nest.js   │
        ▼                             └────┬──────┘
   (SSE/WS)                                  │ Cache miss
  Push update                                ▼
                                        ┌──────────┐
                                        │  Redis   │ (熱層 30‑60 s)
                                        └────┬─────┘
                                             ▼
                                        ┌──────────┐
                                        │ MongoDB  │ (溫層快照 + 歷史)
                                        └──────────┘
```

---

## 2. 資料源選擇

| **鏈**       | **推薦供應商**     | **為什麼選它**                                                            | **關鍵 API／功能**                     |
| ------------ | ------------------ | ------------------------------------------------------------------------- | -------------------------------------- |
| **Ethereum** | **Alchemy (EVM)**  | `getTokenBalances` + `getNftsForOwner` 一行搞定；Address Activity Webhook | Token/NFT API, Webhook                 |
| **Solana**   | **Alchemy Solana** | 同家服務，介面類似；單呼叫拿 SOL + SPL Token + NFT，並支援 Webhook        | `balances`, `getNFTs`, Address Webhook |

> **MVP 策略** — 同一個 Alchemy 帳號開兩把 Key（ETH vs SOL），共享免費額度 100 M CU/月；日活 > 5 k 再考慮升級 Pay‑Go 或自架節點。

| **評比面向**                                   | **DeBank OpenAPI**                                                                                                                                                                                                                    | **OKX Wallet API**                                                                                                                                                                                                                         | \***\*Alchemy**<br/>（RPC＋Token/NFT API＋Webhooks）\*\*                                                                      | \***\*純 JSON-RPC**<br/>（自架或代管）\*\*                                                                  | \***\*自建索引中心**<br/>（全節點＋Indexer ╱ ETL）\*\*                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --- |
| **覆蓋範圍** <br/><br/>（多鏈 / ERC-20 / NFT） | ✅ 100+ 鏈、ERC20+NFT，一次打包 [docs.cloud.debank.com](https://docs.cloud.debank.com/en/readme/api-pro-reference/user?utm_source=chatgpt.com)[docs.cloud.debank.com](https://docs.cloud.debank.com/en/readme/api-pro-reference/user) | ✅ 多鏈含 BTC Inscription 系 [OKX](https://www.okx.com/web3/build/docs/waas/walletapi-api-all-token-balances-by-address?utm_source=chatgpt.com)[OKX](https://www.okx.com/web3/build/docs/waas/walletapi-api-all-token-balances-by-address) | ⚠️ EVM 鏈；ERC-20 + ERC-721/1155（NFT Gallery）[Alchemy](https://www.alchemy.com/pricing?utm_source=chatgpt.com)              | ❌ 只能查單鏈；NFT 需額外 call                                                                              | ✅ 想抓什麼就抓什麼，完全自由                                                         |
| **資料新鮮度 / Latency**                       | ⚠️ 每 10–60 s 聚合，同步頻率不透明                                                                                                                                                                                                    | ⚠️ 官方號稱 < 1 block，實測 5–15 s                                                                                                                                                                                                         | ✅ 直接 latest block；Webhook < 2 s [Alchemy](https://www.alchemy.com/webhooks?utm_source=chatgpt.com)                        | ✅ 跟區塊同步；自架最快 < 1 s                                                                               | ✅ 事件流即時寫庫，可做到 < 1 s                                                       |
| **推送機制** <br/><br/>（主動通知帳變）        | ❌ 無；需輪詢                                                                                                                                                                                                                         | ❌ 無；需輪詢                                                                                                                                                                                                                              | ✅ Address Activity / Custom Webhook                                                                                          | ⚠️ 要自己訂閱 `eth_subscribe` 或輪詢                                                                        | ✅ 自己決定：Kafka / WebSocket / MQ                                                   |
| **開發便利**                                   | ✅ 一條 REST 拿完                                                                                                                                                                                                                     | ✅ 類似；文件清楚                                                                                                                                                                                                                          | ✅ SDK + Dashboard，幾行就跑                                                                                                  | ⚠️ 需列白名單，手動打 `balanceOf` / `eth_call`                                                              | ❌ 開發＋維運成本最大                                                                 |
| **併發&流量上限**                              | ⚠️ 單 AccessKey 典型 50–150 QPS（依配額）                                                                                                                                                                                             | ⚠️ 1000 req/min ；再上去需申請                                                                                                                                                                                                             | ✅ 免費 tier 25 RPS；100 M CU/月[Alchemy](https://www.alchemy.com/pricing?utm_source=chatgpt.com)                             | 取決於節點服務商；自架 QPS 無上限                                                                           | ✅ 取決於基礎設計與機器規模                                                           |
| **費用**                                       | 免費試用＋按「Units」計價；大約 US$0.5 – 1/10 k req [docs.cloud.debank.com](https://docs.cloud.debank.com/en/readme/auxiliary-feature/units)                                                                                          | 目前免費，僅需 API Key；未公佈商業價                                                                                                                                                                                                       | 免費→Pay-as-you-go US$5 起 / 11 M CU；高階 tier US$199+ /月 [Alchemy](https://www.alchemy.com/pricing?utm_source=chatgpt.com) | \- 代管節點：US$49 – 299 /月 <br/><br/>- 自架：SSD 1 TB + 16 GB RAM ≈ US$100 /月（硬體 & 雲） quicknode.com | \- 全節點 × N 鏈 + 儲存 <br/><br/>- Indexer/ETL → 人力 + 叢集；月 burn 4–5 位數美金起 |
| **可擴展 / Vendor Lock-in**                    | ⚠️ 只能用 DeBank；不可自訂指標                                                                                                                                                                                                        | ⚠️ 綁 OKX　但跨鏈多                                                                                                                                                                                                                        | ✅ 同時給原始 RPC，可隨時換家                                                                                                 | ✅ 完全中立                                                                                                 | ✅ 自己的數據倉，最自由                                                               |
| **綜合評語**                                   | **極快上線 & 多鏈**，但配額 + 鎖                                                                                                                                                                                                      | **跨鏈最廣**，適合錢包場景，仍有 rate-limit                                                                                                                                                                                                | **最佳折衷**：低門檻、Webhook 秒級、易橫向                                                                                    | **成本最低**，但寫程式最麻煩；多地址×多 Token 時延遲高                                                      | **長期終極形態**；早期不划算                                                          |     |

---

## 觀察重點

1. 多鏈 vs. 單鏈
   - **MVP 只支援 Ethereum**：第三方 EVM API（Alchemy、Infura、QuickNode…）就夠。
   - **未來要吃 L2、BTC、Solana**：OKX 或 DeBank 這種 aggregator 省事；最終再把熱門鏈自建索引搬回來降低邊際成本。
1. 「最快同步」≠「最低延遲 API」
   - 自己跑全節點拉 `eth_getBalance` 固然區塊級同步，但**ERC-20 要一支合約一 call**（或 multicall），十幾二十枚 token 就上百 RPC；反而 aggregator 回一包 JSON 更快。
   - 若要**即時推播**（有人 transfer 就彈訊息），Alchemy Notify 、Infura Tx Pool 或自建 WebSocket 訂閱是首選。
1. 成本計算
   - Alchemy 免費 100 M CU ≈ 2.5 M `getTokenBalances`，中小產品幾乎用不完。
   - DeBank「Units」平均 1 API ≈ 10 units；日 10 k 呼叫只花 ~US$5。
   - 自架 Erigon + PostgreSQL + The Graph：硬體一年 2 k – 3 k US$，還要 DevOps 人力。

---

## 3. API 介面（統一輸出）

```other
{
  "chainId": 1,                  // 1 = Ethereum, 101 = Solana
  "native": {                    // ETH or SOL
    "symbol": "ETH",
    "decimals": 18,
    "balance": "0.832554",
    "usd": 2436.12
  },
  "fungibles": [                 // ERC‑20 or SPL‑Token
    {
      "mint": "0x6b1754…",
      "symbol": "DAI",
      "decimals": 18,
      "balance": "120.5",
      "usd": 120.47
    }
  ],
  "nfts": [                      // ERC‑721/1155 or Metaplex‑NFT
    {
      "mint": "0xabc…",
      "tokenId": "1234",
      "collection": "Pudgy Penguins",
      "name": "Pudgy #1234",
      "image": "ipfs://…"
    }
  ],
  "updatedAt": 1715678900        // Unix 秒
}
```

---

## 4. 服務實作重點

### 4‑1. 介面層

```other
@Get('balances/:chain/:address')
getBalances(
  @Param('chain') chain: 'eth' | 'sol',
  @Param('address') addr: string,
) {
  return this.balanceSvc.getPortfolio(chain, addr)
}
```

### 4‑2. EthService

```other
const [nativeBal, tokenRes, nftRes] = await Promise.all([
  alchemy.core.getBalance(addr, 'latest'),
  alchemy.core.getTokenBalances(addr),
  alchemy.nft.getNftsForOwner(addr, { omitMetadata: false }),
])
```

### 4‑3. SolService

```other
const { nativeBalance, tokens, nfts } =
  await alchemy.solana.getBalancesWithMetadata(addr)
```

- **Webhook**：Alchemy Solana 同樣提供 Address Activity；流程與 ETH 一致。

### 4‑4. 快取策略

| **層級** | **工具**             | **TTL**                          | **失效機制**                |
| -------- | -------------------- | -------------------------------- | --------------------------- |
| Edge     | Cloudflare Cache‑API | 15 s                             | `Cache‑Tag: addr‑{address}` |
| 熱層     | Redis                | 30 s (native) / 60 s (token/NFT) | Webhook → `DEL key`         |
| 溫層     | MongoDB              | 永久                             | 分區 (日)；資產走勢         |

---

## 5. 即時同步

1. 鏈上活動產生 → Alchemy Address Webhook → `/webhook`
2. Worker：寫 Mongo 歷史 → `DEL Redis` → SSE/WS 通知前端

---

## 6. 成本估算（雙鏈同帳號）

| **階段** | **月 CU**                    | **費用**                |
| -------- | ---------------------------- | ----------------------- |
| PoC      | ≤ 100 M CU                   | **US$0** (Alchemy Free) |
| 成長     | ~200 M CU                    | Alchemy Pay‑go ≈ US$50  |
| 海量     | 自架節點 (ETH 150 + SOL 200) | ≈ US$350 + Ops          |

Redis Upstash ≤ 10 K Cmd/月免費；Mongo Atlas M0 免費。超量後以 PAYG 計。

---

## 7. `src/` 目錄

```other
src/
├─ main.ts & app.module.ts
│
├─ core/
│   ├─ balance/
│   ├─ cache/
│   └─ db/
│
├─ chains/
│   ├─ ethereum/
│   └─ solana/
│
├─ providers/
│   ├─ alchemy/
│   └─ rpc/
│
└─ webhook/
```

---

## 8. 環境變數

```other
ALCHEMY_API_KEY_ETH=xxxxxxxx
ALCHEMY_API_KEY_SOL=yyyyyyyy
REDIS_URL=redis://……
MONGO_URL=mongodb+srv://……
```

---

## 9. Roadmap

- ETH Mainnet MVP
- Solana 上線
- Arbitrum / Optimism 插件
- 前端 Dashboard (Next.js + shadcn/ui)

---

## 10. License

MIT © 2025 SD0
