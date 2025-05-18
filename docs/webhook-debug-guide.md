# Alchemy Webhook 本地開發與調試指南

## 概述

在區塊鏈應用開發過程中，實時數據同步是一個常見需求。Alchemy 提供的 Webhook 服務能夠在區塊鏈上發生特定事件時，即時通知你的應用。然而，在本地開發環境中測試 Webhook 通常面臨一個挑戰：**外部服務無法直接訪問你的 localhost**。

本指南提供一套完整的工作流程，讓你能夠在本地環境中高效地開發和調試 Alchemy Webhook。核心思路是「**把外網流量安全地引到 localhost，再用 Dashboard 的 Test Webhook 或 GraphQL Playground 打假資料，最後靠 ngrok / Postman 重播封包逐條比對**」。

## 系統 Webhook 架構

我們的系統使用了模組化的 Webhook 處理架構，主要包含以下組件：

### 核心服務

1. **WebhookManagementService** (`src/webhook/webhook-management.service.ts`)

   - 管理 Alchemy webhook 的創建、更新和監控
   - 維護地址到 webhook 的映射關係
   - 提供獲取 webhook 詳情和簽名密鑰的方法

2. **WebhookService** (`src/webhook/webhook.service.ts`)

   - 處理接收到的 webhook 事件
   - 根據事件類型執行相應的業務邏輯
   - 通過 NotificationService 發送通知

3. **WebhookAddressReconciliationService** (`src/webhook/webhook-address-reconciliation.service.ts`)
   - 定期清理過期的監控地址
   - 自動保留系統預設監控地址
   - 每日凌晨 3 點執行校正任務

### 工具類與常量

1. **AlchemyNetworkUtils** (`src/webhook/utils/alchemy-network.utils.ts`)

   - 提供 Alchemy 網絡 ID 與系統鏈名稱的雙向映射
   - 統一管理 Network 枚舉與字符串之間的轉換

2. **DEFAULT_MONITORED_ADDRESS** (`src/webhook/constants/webhook.constants.ts`)
   - 系統預設監控地址，永不自動移除
   - 用於 webhook 創建時的初始化

### 使用範例

```typescript
// 注入 webhook 服務
constructor(
  private webhookManagementService: WebhookManagementService,
  private alchemyNetworkUtils: AlchemyNetworkUtils,
) {}

// 獲取 webhook 下的地址
async getAddresses(chain: ChainName, webhookId: string) {
  const addresses = await this.webhookManagementService
    .getWebhookDetailsWithSdk(chain, webhookId);
  return addresses;
}

// 轉換網絡 ID
getChainFromNetworkId(networkId: string) {
  return AlchemyNetworkUtils.getChainNameFromNetworkId(networkId);
}
```

## 1. 建立可公開且可檢視的本地端 URL

### 使用 ngrok（官方合作範例最多）

#### 1.1 安裝並登入

```bash
brew install ngrok/ngrok/ngrok
ngrok config add-authtoken $YOUR_TOKEN
```

#### 1.2 開通 HTTPS 隧道

```bash
ngrok http 3000 --verify-webhook=alchemy \
  --verify-webhook-secret=$SIGNING_KEY
```

這行指令不僅開通了隧道，還替你驗證 Webhook 簽名，省去手動實現 HMAC 驗證的麻煩。

#### 1.3 設置 Webhook URL

複製 ngrok 提供的 `https://xxxxx.ngrok.io` URL，將其作為 Webhook URL 貼到 Alchemy Dashboard。

### 其他選擇

雖然 Cloudflare Tunnel、localtunnel 等工具也能實現類似功能，但它們缺少 ngrok 提供的封包 Replay 與 Signature 驗證等現成功能，使用時需要自行實現這些邏輯。

## 2. 在 Alchemy Dashboard 直接測試事件

| 位置                                  | 功能                        | 用途                                                                     |
| ------------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| 任何 Webhook 詳情頁 → TEST WEBHOOK    | 立即送一筆範例 payload      | 驗證端點是否返回 200 / 簽名是否通過，且能在 ngrok Inspector 查看原始封包 |
| Custom Webhook Playground → Test 按鈕 | 針對 GraphQL 查詢跑單次測試 | 可指定歷史區塊、快速調整 query syntax                                    |

Alchemy 會將測試封包發送到你設置的 ngrok URL；你可以在 `http://localhost:4040/inspect/http` 即時查看與重播這些請求。

## 3. 快速搭建本地 Webhook Server

```typescript
// server.ts
import express from 'express';
import crypto from 'crypto';

const APP_PORT = 3000;
const SIGNING_KEY = process.env.ALCHEMY_SIGNING_KEY!;

const app = express();
app.use(express.json({ verify: rawBodySaver }));
function rawBodySaver(req: any, _res: any, buf: Buffer) {
  req.rawBody = buf.toString('utf8');
}

app.post('/webhook', (req, res) => {
  const sig = req.header('X-Alchemy-Signature');
  const hmac = crypto.createHmac('sha256', SIGNING_KEY).update(req.rawBody).digest('hex');
  if (hmac !== sig) return res.status(401).send('Invalid signature');

  console.log(JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.listen(APP_PORT, () => console.log(`🚀 listening on http://localhost:${APP_PORT}`));
```

搭配 `nodemon server.ts` 使用，你可以在修改代碼的同時自動重啟服務，並通過 ngrok 和 Alchemy 的 Test Webhook 功能即時驗證更改。GitHub 上有完整的範例專案可供參考。

## 4. 進階封包檢視與重播

| 工具                   | 亮點                                             | 典型場景                         |
| ---------------------- | ------------------------------------------------ | -------------------------------- |
| ngrok Inspector        | GUI 界面查看 Header / Body，一鍵 Replay          | 模擬重送、比對不同版本程式碼行為 |
| Postman                | 匯入 cURL 或 raw JSON 即可重打請求               | 撰寫自動化測試、驗證 edge case   |
| Mailchain + ngrok 範例 | 將 Alchemy Address Activity Webhook 轉寄成 Email | Demo 展示或即時告警              |

## 5. 如何使用本項目的 Webhook 功能

### 5.1 配置必要的環境變數

在 `.env` 文件中設置以下關鍵參數：

```
# Alchemy API 配置
BLOCKCHAIN__ALCHEMY_TOKEN=your_alchemy_token
BLOCKCHAIN__ALCHEMY_API_KEY=your_alchemy_api_key

# Webhook URL 配置
WEBHOOK__URL=https://your-ngrok-url.ngrok.io/webhook
```

### 5.2 監控新地址

透過 webhook 系統監控新地址的示例代碼：

```typescript
import { Injectable } from '@nestjs/common';
import { WebhookManagementService } from '../webhook/webhook-management.service';
import { ChainName } from '../chains/constants';

@Injectable()
export class YourService {
  constructor(private webhookManagementService: WebhookManagementService) {}

  async monitorAddress(chain: ChainName, address: string): Promise<boolean> {
    try {
      // 添加地址到 webhook 監控
      return await this.webhookManagementService.updateWebhookAddresses(
        chain,
        [address], // 要添加的地址
        [], // 不移除任何地址
      );
    } catch (error) {
      console.error('監控地址失敗:', error);
      return false;
    }
  }
}
```

## 6. 常見 Debug 陷阱

1. **簽名不符**：記得使用「raw 未解析字串」進行 HMAC 計算；Express 需要添加 verify callback。
2. **URL 未使用 HTTPS**：Alchemy 僅接受 HTTPS；ngrok 預設支持，但 localtunnel 需要加 `--https` 參數。
3. **304/301 被快取或轉址**：Webhook 端點應返回純 200 狀態碼，避免框架自動進行 redirect。
4. **事件重送順序**：失敗重送會穿插在新事件中，請使用 id 去重並用 createdAt 欄位進行排序。
5. **無法獲取 webhook 地址**：確認 `getWebhookDetailsWithSdk` 是否使用正確的 chainName 和 webhookId。
6. **預設地址被移除**：檢查 `DEFAULT_MONITORED_ADDRESS` 常量是否正確設置，以及比較時是否進行了大小寫轉換。

## 7. 整體流程示意

1. `npm run dev` → 啟動 Express 伺服器
2. `ngrok http 3000 --verify-webhook=alchemy ...` → 獲取外網 URL
3. 在 Dashboard 貼上 URL、點擊 Test Webhook → 接收測試資料
4. 在 Inspector 或 Postman 反覆 Replay，逐步調整簽名驗證、ORM schema、業務邏輯
5. 完成後，將 ngrok URL 替換為正式網域，再用 Send Test 進行最終驗證

## 相關資源

- [Webhook 機制設計說明](.cursor/rules/webhook.mdc) - 系統 webhook 模組的詳細文檔
- [SSE 快取失效通知系統設計](.cursor/rules/sse-design.mdc) - 與 webhook 相關的即時通知機制
- [Alchemy Webhook 官方文檔](https://docs.alchemy.com/reference/webhook-endpoints) - 官方 API 參考

## 結語

透過這套流程，即使在離線開發環境中，也能在短短幾分鐘內完成 Alchemy Webhook 的全面測試。這不僅加速了開發流程，還能在部署到生產環境前捕捉到潛在問題，確保你的應用能夠可靠地接收和處理區塊鏈事件通知。

如需測試多鏈(Multi-chain)或處理大批量地址更新的自動化腳本，可以進一步擴展本指南中的方法。
