import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { NotFoundException } from '@nestjs/common';
import { ChainRouter } from './chain-router.service';
import { CHAIN_INFO_MAP } from '../../constants';
import { GLOBAL_CHAIN_SERVICE_MAP } from '../../decorators/chain.decorator';
import { AbstractEvmChainService } from './abstract-evm-chain.service';
import { ChainService } from '../../interfaces/chain-service.interface';
import { ChainName } from '../../constants';
import { ConfigService } from '@nestjs/config';
import { ProviderFactory } from '../../../providers/provider.factory';

// 模擬 Provider Factory
class MockProviderFactory {
  getProvider = jest.fn();
}

// 模擬 EVM 鏈服務
class MockEvmChainService extends AbstractEvmChainService {
  // 實現必要的方法
  evmChain(): ChainName {
    return ChainName.ETHEREUM;
  }

  // 其他必要的實現已在 AbstractEvmChainService 中
  setChainId = jest.fn();
  getBalance = jest.fn();
  getAddressActivity = jest.fn();
}

// 模擬非 EVM 鏈服務
class MockNonEvmChainService implements ChainService {
  isValidAddress = jest.fn().mockReturnValue(true);
  getAddressTransactionHashes = jest.fn().mockResolvedValue(['0x123']);
  getTransactionDetails = jest.fn().mockResolvedValue({});
  getChainName = jest.fn().mockReturnValue('Solana');
  getChainSymbol = jest.fn().mockReturnValue('SOL');
}

describe('ChainRouter', () => {
  let chainRouter: ChainRouter;
  let moduleRef: ModuleRef;

  // 保留原始數據以便稍後還原
  const originalChainInfoMap = { ...CHAIN_INFO_MAP };
  const originalServiceMap = new Map(GLOBAL_CHAIN_SERVICE_MAP);

  // 測試服務實例
  const mockProviderFactory = new MockProviderFactory();
  const mockConfigService = {
    get: jest.fn(),
  };
  const mockEvmService = new MockEvmChainService(
    mockProviderFactory as any,
    mockConfigService as any,
  );
  const mockNonEvmService = new MockNonEvmChainService();

  beforeAll(() => {
    // 清除原有映射以避免干擾
    GLOBAL_CHAIN_SERVICE_MAP.clear();

    // 設置模擬的服務映射，使用正確的鏈名稱
    GLOBAL_CHAIN_SERVICE_MAP.set(ChainName.ETHEREUM, MockEvmChainService);
    GLOBAL_CHAIN_SERVICE_MAP.set(ChainName.SOLANA, MockNonEvmChainService);
  });

  afterAll(() => {
    // 恢復原始映射
    GLOBAL_CHAIN_SERVICE_MAP.clear();

    // 從原始映射恢復
    originalServiceMap.forEach((service, chain) => {
      GLOBAL_CHAIN_SERVICE_MAP.set(chain, service);
    });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainRouter,
        {
          provide: ProviderFactory,
          useValue: mockProviderFactory,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    chainRouter = module.get<ChainRouter>(ChainRouter);
    moduleRef = module.get<ModuleRef>(ModuleRef);

    // 模擬 moduleRef.get 方法
    jest.spyOn(moduleRef, 'get').mockImplementation((token) => {
      if (token === MockEvmChainService) {
        return mockEvmService;
      } else if (token === MockNonEvmChainService) {
        return mockNonEvmService;
      }
      return null;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('dispatch', () => {
    it('應該成功分發請求到對應的 EVM 鏈服務', () => {
      // 準備測試數據
      const chainId = 1; // Ethereum 的 chainId
      const action = jest.fn().mockReturnValue('EVM 結果');

      // 執行
      const result = chainRouter.dispatch(chainId, action);

      // 驗證
      expect(moduleRef.get).toHaveBeenCalledWith(MockEvmChainService, { strict: false });
      expect(mockEvmService.setChainId).toHaveBeenCalledWith(chainId);
      expect(action).toHaveBeenCalledWith(mockEvmService);
      expect(result).toBe('EVM 結果');
    });

    it('應該成功分發請求到對應的非 EVM 鏈服務', () => {
      // 準備測試數據
      const chainId = 101; // Solana 的 chainId
      const action = jest.fn().mockReturnValue('非 EVM 結果');

      // 執行
      const result = chainRouter.dispatch(chainId, action);

      // 驗證
      expect(moduleRef.get).toHaveBeenCalledWith(MockNonEvmChainService, { strict: false });
      expect(mockEvmService.setChainId).not.toHaveBeenCalled(); // 非 EVM 不應該呼叫 setChainId
      expect(action).toHaveBeenCalledWith(mockNonEvmService);
      expect(result).toBe('非 EVM 結果');
    });

    it('當鏈 ID 不存在時應拋出 NotFoundException', () => {
      // 準備測試數據
      const invalidChainId = 123456; // 無效 ID
      const action = jest.fn();

      // 驗證
      expect(() => {
        chainRouter.dispatch(invalidChainId, action);
      }).toThrow(NotFoundException);
      expect(action).not.toHaveBeenCalled();
    });

    it('當鏈名稱沒有對應服務時應拋出 NotFoundException', () => {
      // 添加一個沒有對應服務的鏈，但不修改 GLOBAL_CHAIN_SERVICE_MAP
      const testChainId = 777;

      // 臨時修改 CHAIN_INFO_MAP 以包含測試鏈
      const testChainName = 'test_chain' as ChainName;
      Object.defineProperty(CHAIN_INFO_MAP, testChainName, {
        value: {
          id: testChainId,
          name: testChainName,
          display: 'Test Chain',
          coinSymbols: ['TEST'],
          isMainnet: true,
        },
        configurable: true,
        enumerable: true,
      });

      // 準備測試數據
      const action = jest.fn();

      // 驗證
      expect(() => {
        chainRouter.dispatch(testChainId, action);
      }).toThrow(NotFoundException);
      expect(action).not.toHaveBeenCalled();

      // 清理
      delete CHAIN_INFO_MAP[testChainName];
    });

    it('當無法實例化服務時應拋出 NotFoundException', () => {
      // 準備測試數據
      const chainId = 1; // Ethereum 的 chainId
      const action = jest.fn();

      // 模擬 moduleRef.get 返回 null
      jest.spyOn(moduleRef, 'get').mockReturnValue(null);

      // 驗證
      expect(() => {
        chainRouter.dispatch(chainId, action);
      }).toThrow(NotFoundException);
      expect(action).not.toHaveBeenCalled();
    });
  });
});
