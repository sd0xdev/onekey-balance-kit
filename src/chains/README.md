# 鏈服務模組 (Chain Services)

本模組提供了一個統一的方式來處理不同區塊鏈的操作，使用混合架構結合工廠模式、裝飾器自動註冊機制和代理模式。

## 目錄結構

```
src/chains/
├── interfaces/            # 介面定義
│   └── chain-service.interface.ts  # 鏈服務介面
│   └── balance-queryable.interface.ts  # 餘額查詢介面
├── decorators/            # 裝飾器定義
│   └── chain.decorator.ts            # 鏈服務裝飾器
│   └── blockchain-provider.decorator.ts  # 區塊鏈提供者裝飾器
├── interceptors/          # 攔截器
│   └── blockchain-provider.interceptor.ts  # 區塊鏈提供者攔截器
├── services/              # 服務實現
│   ├── core/              # 核心服務
│   │   ├── abstract-chain.service.ts   # 抽象鏈服務基類
│   │   ├── chain-service.factory.ts    # 鏈服務工廠
│   │   ├── discovery.service.ts        # 裝飾器發現服務
│   │   ├── blockchain.service.ts       # 區塊鏈服務
│   │   └── request-context.service.ts  # 請求上下文服務
│   ├── ethereum/                   # 以太坊服務
│   │   └── ethereum.service.ts
│   └── solana/                     # Solana 服務
│       └── solana.service.ts
├── controllers/           # 控制器
│   └── chains.controller.ts        # 鏈服務 API 控制器
├── constants/             # 常量定義
│   └── index.ts                    # 鏈相關常量
├── blockchain.module.ts   # 區塊鏈模組 (整合了原有的 ChainsModule)
├── index.ts               # 入口檔案
└── README.md              # 本文檔
```

## 架構設計

本模組使用了混合架構設計：

1. **介面定義**：`ChainService` 介面定義了所有鏈服務必須實現的方法。
2. **抽象基類**：`AbstractChainService` 提供了基本實現和輔助方法。
3. **工廠模式**：`ChainServiceFactory` 負責創建和管理不同鏈的服務實例。
4. **裝飾器發現**：使用 `@Chain()` 裝飾器和 `DiscoveryService` 自動發現並註冊鏈服務。
5. **代理模式**：使用 `getChainServiceWithProvider` 創建代理對象，動態切換區塊鏈提供者而不改變原服務默認值。
6. **請求級別的提供者選擇**：使用 `@UseBlockchainProvider()` 裝飾器和攔截器動態選擇區塊鏈提供者。

這種混合架構具有以下優點：

- **統一介面**：所有鏈服務遵循相同的介面，使用方式一致。
- **易於擴展**：新增鏈只需實現介面並添加 `@Chain()` 裝飾器。
- **自動發現**：通過裝飾器自動註冊服務，減少手動配置。
- **靈活性**：同時支持自動和手動註冊，滿足不同需求。
- **動態提供者選擇**：能夠動態切換區塊鏈提供者而不改變服務的默認設置。
- **請求級別隔離**：不同請求可以使用不同的區塊鏈提供者而不互相影響。

## 區塊鏈提供者處理

本模組引入了一個新的區塊鏈提供者處理機制，允許在不同級別選擇區塊鏈提供者：

### 提供者選擇優先級

1. **查詢參數**：請求查詢參數中的 `provider` 參數優先級最高
2. **方法裝飾器**：在控制器方法上使用的 `@UseBlockchainProvider()` 裝飾器次之
3. **控制器裝飾器**：在控制器類上使用的 `@UseBlockchainProvider()` 裝飾器再次之
4. **配置文件**：從配置文件中讀取的默認提供者最後
5. **硬編碼默認值**：如果以上都沒有設置，則使用硬編碼的默認值

### 區塊鏈提供者裝飾器

使用 `@UseBlockchainProvider()` 裝飾器可以指定要使用的區塊鏈提供者：

```typescript
// 在控制器級別設置默認提供者
@Controller('chains')
@UseBlockchainProvider('alchemy')
export class ChainsController {
  // 所有方法默認使用 'alchemy' 提供者

  // 在方法級別覆蓋提供者設置
  @Get('eth/:address/balance')
  @UseBlockchainProvider('quicknode')
  getEthereumBalance(@Param('address') address: string) {
    // 使用 'quicknode' 提供者
  }
}
```

### 提供者代理

當使用 `getChainServiceWithProvider` 方法時，ChainServiceFactory 會創建一個原始服務的代理，該代理會在保持原始服務默認提供者不變的情況下使用指定的提供者：

```typescript
// 獲取使用 'quicknode' 提供者的以太坊服務代理
const ethService = chainServiceFactory.getChainServiceWithProvider('ethereum', 'quicknode');

// 原始服務的默認提供者保持不變
const originalService = chainServiceFactory.getChainService('ethereum');
```

## 使用方式

### 1. 導入模組

在應用的主模組中導入 `BlockchainModule`：

```typescript
import { Module } from '@nestjs/common';
import { BlockchainModule } from './chains/blockchain.module';

@Module({
  imports: [BlockchainModule],
})
export class AppModule {}
```

### 2. 使用區塊鏈服務

通過依賴注入使用 `BlockchainService`：

```typescript
import { Injectable } from '@nestjs/common';
import { BlockchainService } from './chains/services/core/blockchain.service';

@Injectable()
export class YourService {
  constructor(private readonly blockchainService: BlockchainService) {}

  async someMethod() {
    // 獲取特定鏈的服務 - 會自動使用請求上下文中的提供者
    const ethereumService = this.blockchainService.getService('ethereum');

    // 使用服務方法
    const isValid = ethereumService.isValidAddress('0x...');
    const balance = await ethereumService.getBalances('0x...');
  }
}
```

### 3. 在控制器中使用裝飾器

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { UseBlockchainProvider } from './chains/decorators/blockchain-provider.decorator';
import { BalanceService } from './core/balance/balance.service';

@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':chain/:address')
  @UseBlockchainProvider('alchemy') // 設置預設提供者為 alchemy
  getBalances(@Param('chain') chain: string, @Param('address') address: string) {
    return this.balanceService.getPortfolio(chain, address);
  }
}
```

### 4. 客戶端指定提供者

客戶端可以通過查詢參數指定提供者：

```
GET /balances/ethereum/0x742d35Cc6634C0532925a3b844Bc454e4438f44e?provider=quicknode
```

此請求會使用 quicknode 提供者而不是方法裝飾器中的默認值。

### 5. 添加新的鏈服務

要添加新的鏈服務，需要：

1. 創建服務類並繼承 `AbstractChainService`：

```typescript
import { Injectable } from '@nestjs/common';
import { AbstractChainService } from './chains/services/core/abstract-chain.service';
import { Chain } from './chains/decorators/chain.decorator';
import { ChainName } from './chains/constants';
import { ConfigService } from '@nestjs/config';

@Injectable()
@Chain(ChainName.YOUR_CHAIN)
export class YourChainService extends AbstractChainService {
  constructor(protected readonly configService: ConfigService) {
    super();
    // 從配置中獲取默認提供者
    const defaultProvider = this.configService.get<string>('blockchain.defaultProvider', 'alchemy');
    this.setDefaultProvider(defaultProvider);
  }

  // 實現必要的方法...
}
```

## 最佳實踐

1. **使用抽象類**：繼承 `AbstractChainService` 而不是直接實現介面，以獲取通用功能。
2. **使用請求作用域**：所有需要訪問請求上下文的服務應使用 `{ scope: Scope.REQUEST }` 進行注入。
3. **裝飾器設置默認值**：使用 `@UseBlockchainProvider()` 裝飾器設置方法或控制器的默認提供者。
4. **配置驅動**：使用配置文件設置系統級別的默認提供者。
5. **允許客戶端覆蓋**：允許客戶端通過查詢參數覆蓋默認提供者設置。

## 內部工作原理

1. **裝飾器和攔截器**：當請求到達時，`BlockchainProviderInterceptor` 會解析並設置請求上下文中的 `blockchainProvider`。
2. **請求作用域服務**：`BlockchainService` 和 `BalanceService` 使用請求作用域，以訪問請求上下文。
3. **服務代理**：當需要使用特定提供者時，`ChainServiceFactory` 會創建一個服務代理，該代理會覆蓋 `getDefaultProvider` 和 `setDefaultProvider` 方法。
4. **工廠級緩存**：`ChainServiceFactory` 會緩存創建的服務和代理，以提高性能。

## API 端點

鏈服務模組提供了以下 API 端點：

- `GET /chains`: 獲取所有支持的鏈類型
- `GET /chains/:chain/validate/:address`: 驗證地址是否有效
- `GET /chains/:chain/transactions/:address`: 獲取地址的交易歷史

## 自動發現和註冊機制

本模組使用 `@Chain()` 裝飾器和 `DiscoveryService` 實現了鏈服務的自動發現和註冊：

1. **服務標記**：使用 `@Chain(ChainName.XXX)` 裝飾器標記鏈服務
2. **啟動時發現**：在 `ChainServiceFactory` 的 `onModuleInit` 生命週期中，自動掃描所有標記的服務
3. **自動註冊**：將發現的服務註冊到工廠中
4. **零配置添加**：新增鏈服務只需添加 `@Chain()` 裝飾器，無需手動註冊

這種設計使得擴展新的區塊鏈變得簡單高效，同時保持了代碼的解耦和可維護性。

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

## 重構變更說明

最新的重構將原有的 `ChainsModule` 與 `BlockchainModule` 進行了整合，並對目錄結構進行了優化：

1. **模組整合**：移除了 `modules` 目錄，將所有功能集中到 `BlockchainModule` 中
2. **目錄結構優化**：
   - 核心服務移至 `services/core` 子目錄
   - 保持鏈特定服務在 `services/[chain-name]` 中
3. **移除冗餘**：刪除了不必要的參數裝飾器，完全依賴請求上下文和攔截器
4. **請求上下文驅動**：所有鏈服務和提供者選擇都通過請求上下文實現隔離

這些變更使模組結構更加清晰，並優化了服務間的交互方式，同時保留了強大的自動發現註冊機制。
