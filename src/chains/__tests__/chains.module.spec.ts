import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChainsModule } from '../chains.module';
import { ChainServiceFactory } from '../services/core/chain-service.factory';
import { BlockchainService } from '../services/core/blockchain.service';
import { ChainRouter } from '../services/core/chain-router.service';
import { EthereumService } from '../services/ethereum/ethereum.service';
import { SolanaService } from '../services/solana/solana.service';
import { PolygonService } from '../services/polygon/polygon.service';
import { BscService } from '../services/bsc/bsc.service';

// 模擬 ConfigService
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
    if (key === 'blockchain.enabledChains') {
      return ['ETH', 'SOL', 'POLY', 'BSC'];
    }
    return defaultValue;
  }),
};

describe('ChainsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    // 創建測試模組
    module = await Test.createTestingModule({
      imports: [ChainsModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should export the required services', async () => {
    // 驗證模組正確導出所有服務
    expect(module.get(ChainServiceFactory)).toBeDefined();
    // 修正：使用 resolve 而不是 get 來處理作用域提供者
    const blockchainService = await module.resolve(BlockchainService);
    expect(blockchainService).toBeDefined();
    expect(module.get(ChainRouter)).toBeDefined();
    expect(module.get(EthereumService)).toBeDefined();
    expect(module.get(SolanaService)).toBeDefined();
    expect(module.get(PolygonService)).toBeDefined();
    expect(module.get(BscService)).toBeDefined();
  });

  it('should initialize with config service', () => {
    // 確認配置服務被使用
    expect(mockConfigService.get).toHaveBeenCalledWith('blockchain.enabledChains', ['ETH']);
  });

  describe('register', () => {
    it('should register module with custom enabled chains', () => {
      // 使用靜態 register 方法
      const dynamicModule = ChainsModule.register({
        enabledChains: ['ETH', 'SOL'],
      });

      // 驗證動態模組結構
      expect(dynamicModule.module).toBe(ChainsModule);
      expect(dynamicModule.imports).toHaveLength(4);
      expect(dynamicModule.controllers).toHaveLength(2);
      expect(dynamicModule.providers).toHaveLength(13);
      expect(dynamicModule.exports).toHaveLength(7);

      // 驗證自定義啟用鏈選項 - 修正檢查方式
      const enabledChainsProvider = dynamicModule.providers.find((provider) => {
        if (typeof provider === 'object' && provider !== null) {
          return provider.provide === 'ENABLED_CHAINS_OPTIONS';
        }
        return false;
      });
      expect(enabledChainsProvider).toBeDefined();
      if (enabledChainsProvider && typeof enabledChainsProvider === 'object') {
        expect(enabledChainsProvider['useValue']).toEqual(['ETH', 'SOL']);
      }
    });

    it('should register module with default values when no options provided', () => {
      // 不提供選項
      const dynamicModule = ChainsModule.register();

      // 驗證默認配置 - 修正檢查方式
      const enabledChainsProvider = dynamicModule.providers.find((provider) => {
        if (typeof provider === 'object' && provider !== null) {
          return provider.provide === 'ENABLED_CHAINS_OPTIONS';
        }
        return false;
      });
      expect(enabledChainsProvider).toBeDefined();
      if (enabledChainsProvider && typeof enabledChainsProvider === 'object') {
        expect(enabledChainsProvider['useValue']).toEqual([]);
      }
    });
  });
});
