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

| **鏈**        | **推薦供應商**          | **為什麼選它**                                                            | **關鍵 API／功能**                          |
| ------------ | ------------------ | -------------------------------------------------------------------- | -------------------------------------- |
| **Ethereum** | **Alchemy (EVM)**  | `getTokenBalances` + `getNftsForOwner` 一行搞定；Address Activity Webhook | Token/NFT API, Webhook                 |
| **Solana**   | **Alchemy Solana** | 同家服務，介面類似；單呼叫拿 SOL + SPL Token + NFT，並支援 Webhook                     | `balances`, `getNFTs`, Address Webhook |

> **MVP 策略** — 同一個 Alchemy 帳號開兩把 Key（ETH vs SOL），共享免費額度 100 M CU/月；日活 > 5 k 再考慮升級 Pay‑Go 或自架節點。

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

| **層級** | **工具**               | **TTL**                          | **失效機制**                    |
| ------ | -------------------- | -------------------------------- | --------------------------- |
| Edge   | Cloudflare Cache‑API | 15 s                             | `Cache‑Tag: addr‑{address}` |
| 熱層     | Redis                | 30 s (native) / 60 s (token/NFT) | Webhook → `DEL key`         |
| 溫層     | MongoDB              | 永久                               | 分區 (日)；資產走勢                 |

---

## 5. 即時同步

1. 鏈上活動產生 → Alchemy Address Webhook → `/webhook`
2. Worker：寫 Mongo 歷史 → `DEL Redis` → SSE/WS 通知前端

---

## 6. 成本估算（雙鏈同帳號）

| **階段** | **月 CU**                 | **費用**                  |
| ------ | ------------------------ | ----------------------- |
| PoC    | ≤ 100 M CU               | **US$0** (Alchemy Free) |
| 成長     | ~200 M CU                | Alchemy Pay‑go ≈ US$50  |
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

