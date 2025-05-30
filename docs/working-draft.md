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
Client  │ GET /v1/api/balances             ┌──────────┐
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

#### 1. 主要鏈與推薦供應商

| 鏈           | 推薦供應商         | 為什麼選它                                                                | 關鍵 API／功能                         |
| ------------ | ------------------ | ------------------------------------------------------------------------- | -------------------------------------- |
| **Ethereum** | **Alchemy (EVM)**  | `getTokenBalances` + `getNftsForOwner` 一行搞定；Address Activity Webhook | Token／NFT API、Webhook                |
| **Solana**   | **Alchemy Solana** | 同家服務、介面類似；單呼叫拿 SOL + SPL Token + NFT，並支援 Webhook        | `balances`、`getNFTs`、Address Webhook |

> **MVP 策略** — 同一個 Alchemy 帳號開兩把 Key（ETH vs SOL），共用 100 M CU/月 免費額度；日活 > 5 k 再考慮升級 Pay-Go 或自架節點。

#### 2. 服務比較

| 評比面向                        | DeBank OpenAPI                            | OKX Wallet API                       | **Alchemy**<br>(RPC＋Token/NFT API＋Webhooks) | **純 JSON-RPC**<br>(自架或代管)                             | **自建索引中心**<br>(全節點＋Indexer╱ETL)   |
| ------------------------------- | ----------------------------------------- | ------------------------------------ | --------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| 覆蓋範圍<br>(多鏈／ERC-20／NFT) | ✅ 100+ 鏈，ERC-20 + NFT，一次打包        | ✅ 多鏈含 BTC Inscription 系         | ⚠️ 僅 EVM 鏈，ERC-20 + ERC-721/1155           | ❌ 只能單鏈；NFT 需額外呼叫                                 | ✅ 想抓什麼就抓什麼，完全自由               |
| 資料新鮮度／Latency             | ⚠️ 聚合每 10–60 s，同步頻率不透明         | ⚠️ 官方 < 1 block，實測 5–15 s       | ✅ latest block；Webhook < 2 s                | ✅ 跟區塊同步；自架最快 < 1 s                               | ✅ 事件流即時寫庫，可做到 < 1 s             |
| 推送機制<br>(主動通知帳變)      | ❌ 無；需輪詢                             | ❌ 無；需輪詢                        | ✅ Address Activity／Custom Webhook           | ⚠️ 自行 `eth_subscribe` 或輪詢                              | ✅ Kafka／WebSocket／MQ                     |
| 開發便利                        | ✅ 一條 REST 全拿                         | ✅ 類似；文件清楚                    | ✅ SDK + Dashboard，幾行就跑                  | ⚠️ 要列白，手動 `balanceOf`／`eth_call`                     | ❌ 開發＋維運成本最大                       |
| 併發＆流量上限                  | ⚠️ 單 Key 典型 50–150 QPS                 | ⚠️ 1000 req/min，再高需申請          | ✅ 免費 25 RPS；100 M CU/月                   | 取決於節點服務商；自架無上限                                | ✅ 看機器與架構                             |
| 費用                            | 免費試用＋按 Units 計價；約 US$0.5–1/10 k | 目前免費；僅需 API Key               | 免費→Pay-go US$5 起／11 M CU；高階 US$199+/月 | 代管節點 US$49–299/月；自架 SSD 1 TB＋16 GB RAM ≈ US$100/月 | 全節點×N 鏈＋Indexer → 月燒四、五位數美金起 |
| 可擴展／Vendor Lock-in          | ⚠️ 只能用 DeBank，不能自訂指標            | ⚠️ 綁 OKX，但跨鏈多                  | ✅ 同時給 raw RPC，可隨時換家                 | ✅ 完全中立                                                 | ✅ 自己的資料倉，最自由                     |
| 綜合評語                        | **極快上線 & 多鏈**，但配額＋鎖           | **跨鏈最廣**，適合錢包場景，仍有限流 | **最佳折衷**：Webhook 秒級、易橫向            | **成本最低**，但程式碼最苦手                                | **終極形態**；早期不划算                    |

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

## 7. Roadmap

- ETH Mainnet MVP
- 多鏈抽象／L2／BTC／Solana / Discovery
- Provider 抽象／Discovery
- 前端 Dashboard / SSE 通知
- 後端快取
- 資產走勢（利用過期快取數據組合）
- 價格 API 組合資產現值
- 精細快取失效
  - 鏈上活動
  - 資產變動
  - 資產走勢
- 通知
  - 前端 Dashboard
  - SSE 通知
