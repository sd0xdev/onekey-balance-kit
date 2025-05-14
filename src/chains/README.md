# 鏈服務模組 (Chain Services)

本模組提供了一個統一的方式來處理不同區塊鏈的操作，使用混合架構結合工廠模式和裝飾器自動註冊機制。

## 目錄結構

```
src/chains/
├── interfaces/            # 介面定義
│   └── chain-service.interface.ts  # 鏈服務介面
├── decorators/            # 裝飾器定義
│   └── chain.decorator.ts # 鏈服務裝飾器
├── services/              # 服務實現
│   ├── abstract-chain.service.ts   # 抽象鏈服務基類
│   ├── chain-service.factory.ts    # 鏈服務工廠
│   ├── discovery.service.ts        # 裝飾器發現服務
│   ├── ethereum/                   # 以太坊服務
│   │   └── ethereum.service.ts
│   └── solana/                     # Solana 服務
│       └── solana.service.ts
├── controllers/           # 控制器
│   └── chains.controller.ts        # 鏈服務 API 控制器
├── modules/               # 模組定義
│   ├── chains.module.ts            # 主鏈服務模組
│   ├── ethereum/                   # 以太坊模組
│   │   └── ethereum.module.ts
│   └── solana/                     # Solana 模組
│       └── solana.module.ts
├── constants/             # 常量定義
│   └── index.ts                    # 鏈相關常量
├── index.ts               # 入口檔案
└── README.md              # 本文檔
```

## 架構設計

本模組使用了混合架構設計：

1. **介面定義**：`ChainService` 介面定義了所有鏈服務必須實現的方法。
2. **抽象基類**：`AbstractChainService` 提供了基本實現和輔助方法。
3. **工廠模式**：`ChainServiceFactory` 負責創建和管理不同鏈的服務實例。
4. **裝飾器發現**：使用 `@Chain()` 裝飾器和 `DiscoveryService` 自動發現並註冊鏈服務。
5. **模組化**：各個鏈有自己獨立的模組和服務實現。

這種混合架構具有以下優點：

- **統一介面**：所有鏈服務遵循相同的介面，使用方式一致。
- **易於擴展**：新增鏈只需實現介面並添加 `@Chain()` 裝飾器。
- **自動發現**：通過裝飾器自動註冊服務，減少手動配置。
- **靈活性**：同時支持自動和手動註冊，滿足不同需求。

## 使用方式

### 1. 導入模組

在應用的主模組中導入 `ChainsModule`：

```typescript
import { Module } from '@nestjs/common';
import { ChainsModule } from './chains';

@Module({
  imports: [ChainsModule],
})
export class AppModule {}
```

### 2. 使用工廠服務

通過依賴注入使用 `ChainServiceFactory`：

```typescript
import { Injectable } from '@nestjs/common';
import { ChainServiceFactory, ChainName } from './chains';

@Injectable()
export class YourService {
  constructor(private readonly chainServiceFactory: ChainServiceFactory) {}

  async someMethod() {
    // 獲取特定鏈的服務 - 可以使用鏈名稱
    const ethereumService = this.chainServiceFactory.getChainService(ChainName.ETHEREUM);
    const solanaService = this.chainServiceFactory.getChainService(ChainName.SOLANA);

    // 也可以使用代幣符號（不區分大小寫）
    const ethereumServiceAlt = this.chainServiceFactory.getChainService('eth');
    const solanaServiceAlt = this.chainServiceFactory.getChainService('sol');

    // 使用服務方法
    const isValid = ethereumService.isValidAddress('0x...');
    const transactions = await solanaService.getAddressTransactionHashes('sol_address');
  }
}
```

### 3. 使用 API 端點

鏈服務模組提供的 API 端點也支援使用代幣符號：

```
// 使用鏈名稱
GET /chains/ethereum/validate/0x742d35Cc6634C0532925a3b844Bc454e4438f44e

// 或使用代幣符號（不區分大小寫）
GET /chains/eth/validate/0x742d35Cc6634C0532925a3b844Bc454e4438f44e
GET /chains/ETH/validate/0x742d35Cc6634C0532925a3b844Bc454e4438f44e
```

### 4. 添加新的鏈服務

要添加新的鏈服務，需要：

1. 創建服務類並繼承 `AbstractChainService`：

```typescript
import { Injectable } from '@nestjs/common';
import { AbstractChainService, Chain, ChainName } from '../chains';

@Injectable()
@Chain(ChainName.YOUR_CHAIN) // 使用裝飾器標記
export class YourChainService extends AbstractChainService {
  getChainName(): string {
    return ChainName.YOUR_CHAIN;
  }

  isValidAddress(address: string): boolean {
    // 實現驗證邏輯
    return true;
  }

  async getAddressTransactionHashes(address: string): Promise<string[]> {
    // 實現獲取交易哈希的邏輯
    return ['hash1', 'hash2'];
  }

  async getTransactionDetails(hash: string): Promise<any> {
    // 實現獲取交易詳情的邏輯
    return { hash, details: 'some details' };
  }
}
```

2. 在 `constants/index.ts` 中添加新的鏈類型：

```typescript
export enum ChainName {
  ETHEREUM = 'ethereum',
  SOLANA = 'solana',
  YOUR_CHAIN = 'your_chain', // 添加新的鏈類型
}
```

3. 創建模組並在其中提供服務：

```typescript
import { Module } from '@nestjs/common';
import { YourChainService } from './your-chain.service';

@Module({
  providers: [YourChainService],
  exports: [YourChainService],
})
export class YourChainModule {}
```

4. 在主鏈模組中導入新模組：

```typescript
import { Module } from '@nestjs/common';
import { ChainsModule } from '../chains/modules/chains.module';
import { YourChainModule } from './your-chain/your-chain.module';

@Module({
  imports: [ChainsModule, YourChainModule],
})
export class AppModule {}
```

## API 端點

鏈服務模組提供了以下 API 端點：

- `GET /chains`: 獲取所有支持的鏈類型
- `GET /chains/:chain/validate/:address`: 驗證地址是否有效
- `GET /chains/:chain/transactions/:address`: 獲取地址的交易歷史

## 最佳實踐

1. **使用抽象類**：繼承 `AbstractChainService` 而不是直接實現介面，以獲取通用功能。
2. **使用裝飾器**：為服務類添加 `@Chain()` 裝飾器，啟用自動註冊。
3. **模組化**：每個鏈都應有獨立的服務和模組。
4. **統一異常處理**：使用抽象類中的日誌方法記錄錯誤。
5. **類型安全**：使用適當的類型定義和泛型參數。

## 擴展建議

1. **交易格式轉換器**：添加鏈特定的交易格式轉換邏輯。
2. **餘額查詢**：擴展介面支持查詢代幣餘額和 NFT。
3. **身份驗證**：添加與鏈相關的身份驗證和簽名功能。
4. **鏈間操作**：實現跨鏈操作和資產轉移功能。

## 鏈特定常量

每個鏈都有其特定的常量值，這些常量被封裝在各自鏈的目錄中：

### 以太坊常量

以太坊特定的常量位於 `services/ethereum/constants.ts` 中：

```typescript
// 導入以太坊特定常量
import { EthereumChainId, ETH_SYMBOL, ETH_DECIMALS } from '../chains/services/ethereum/constants';

// 使用以太坊常量
console.log(`以太坊主網鏈 ID: ${EthereumChainId.MAINNET}`);
console.log(`以太坊代幣符號: ${ETH_SYMBOL}`);
console.log(`以太坊代幣精度: ${ETH_DECIMALS}`);
```

### Solana 常量

Solana 特定的常量位於 `services/solana/constants.ts` 中：

```typescript
// 導入 Solana 特定常量
import { SolanaCluster, SOL_SYMBOL, SOL_DECIMALS } from '../chains/services/solana/constants';

// 使用 Solana 常量
console.log(`Solana 主網集群: ${SolanaCluster.MAINNET}`);
console.log(`Solana 代幣符號: ${SOL_SYMBOL}`);
console.log(`Solana 代幣精度: ${SOL_DECIMALS}`);
```

這種模組化的常量組織方式有以下優點：

1. **封裝性**: 每個鏈的特定常量只在該鏈的上下文中可見
2. **可維護性**: 新增或修改特定鏈的常量不會影響其他鏈
3. **語義清晰**: 常量的歸屬關係一目了然
4. **命名空間隔離**: 避免不同鏈間的常量命名衝突

## 地址驗證

為了確保地址驗證的準確性和安全性，我們使用了區塊鏈專用的 SDK 進行嚴謹的驗證：

### 以太坊地址驗證

以太坊地址驗證使用 `ethers` 庫的 `isAddress` 函數，它會執行以下檢查：

- 正確的地址格式和長度
- 符合以太坊地址的校驗和規則
- 支持 EIP-55 大小寫混合檢查

```typescript
import { isAddress } from 'ethers';

// 驗證以太坊地址
const isValid = isAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
```

### Solana 地址驗證

Solana 地址驗證使用 `@solana/web3.js` 庫的 `PublicKey` 類，它會執行以下檢查：

- 地址格式和長度驗證
- Base58 編碼有效性檢查
- Ed25519 密鑰對相關驗證

```typescript
import { PublicKey } from '@solana/web3.js';

// 驗證 Solana 地址
try {
  new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
  console.log('Address is valid');
} catch (error) {
  console.error('Invalid address');
}
```

這種使用專業 SDK 的驗證方法比簡單的正則表達式檢查更加可靠，能夠確保地址在密碼學上是有效的，從而提高應用程序的安全性。
