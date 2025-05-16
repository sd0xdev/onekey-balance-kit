import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { ChainServiceFactory } from './chain-service.factory';
import { RequestContextService } from './request-context.service';
import { ChainService, BalanceResponse } from '../../interfaces/chain-service.interface';

class MockChainService implements ChainService {
  getBalance = jest.fn();
  isValidAddress = jest.fn().mockReturnValue(true);
  getAddressTransactionHashes = jest.fn().mockResolvedValue(['0x123']);
  getTransactionDetails = jest.fn().mockResolvedValue({});
  getChainName = jest.fn().mockReturnValue('Ethereum');
  getChainSymbol = jest.fn().mockReturnValue('ETH');
  getBalances = jest.fn().mockResolvedValue([]);
}

describe('BlockchainService', () => {
  let module: TestingModule;
  let service: BlockchainService;
  let configService: ConfigService;
  let chainServiceFactory: ChainServiceFactory;
  let requestContextService: RequestContextService;

  // 創建一個模擬的 ChainService 實例
  const mockChainService = new MockChainService();

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        BlockchainService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key, defaultValue) => defaultValue), // 默認返回 defaultValue
          },
        },
        {
          provide: ChainServiceFactory,
          useValue: {
            getChainServiceWithProvider: jest.fn(),
            getChainService: jest.fn(),
            isChainAvailable: jest.fn(),
            getAvailableChains: jest.fn(),
          },
        },
        {
          provide: RequestContextService,
          useValue: {
            getBlockchainProvider: jest.fn(),
          },
        },
      ],
    }).compile();

    // 使用 resolve 替代 get 來獲取 scoped provider
    service = await module.resolve<BlockchainService>(BlockchainService);
    configService = module.get<ConfigService>(ConfigService);
    chainServiceFactory = module.get<ChainServiceFactory>(ChainServiceFactory);
    requestContextService = module.get<RequestContextService>(RequestContextService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isChainEnabled', () => {
    it('應該返回鏈是否已啟用', async () => {
      // 設置模擬返回
      jest.spyOn(configService, 'get').mockReturnValue(['ETH', 'BSC']);

      // 測試已啟用的鏈
      expect(service.isChainEnabled('ETH')).toBe(true);
      expect(service.isChainEnabled('BSC')).toBe(true);

      // 測試未啟用的鏈
      expect(service.isChainEnabled('SOL')).toBe(false);

      // 驗證 ConfigService 的調用
      expect(configService.get).toHaveBeenCalledWith('blockchain.enabledChains', ['ETH']);
    });

    it('當未配置啟用鏈時，應該使用默認值 ETH', async () => {
      // 設置模擬返回
      jest.spyOn(configService, 'get').mockReturnValue(['ETH']); // 使用默認值 ['ETH']

      // 測試默認配置
      expect(service.isChainEnabled('ETH')).toBe(true);
      expect(service.isChainEnabled('BSC')).toBe(false);

      // 驗證 ConfigService 的調用
      expect(configService.get).toHaveBeenCalledWith('blockchain.enabledChains', ['ETH']);
    });
  });

  describe('getService', () => {
    it('應該使用當前請求上下文中的提供者獲取鏈服務', async () => {
      // 設置模擬返回
      const provider = 'alchemy';
      jest.spyOn(requestContextService, 'getBlockchainProvider').mockReturnValue(provider);
      jest
        .spyOn(chainServiceFactory, 'getChainServiceWithProvider')
        .mockReturnValue(mockChainService);

      // 調用測試方法
      const result = service.getService('ETH');

      // 驗證結果
      expect(result).toBe(mockChainService);
      expect(requestContextService.getBlockchainProvider).toHaveBeenCalled();
      expect(chainServiceFactory.getChainServiceWithProvider).toHaveBeenCalledWith('ETH', provider);
    });
  });

  describe('getServiceWithProvider', () => {
    it('應該使用指定的提供者獲取鏈服務', async () => {
      // 設置模擬返回
      jest
        .spyOn(chainServiceFactory, 'getChainServiceWithProvider')
        .mockReturnValue(mockChainService);

      // 調用測試方法
      const result = service.getServiceWithProvider('ETH', 'quicknode');

      // 驗證結果
      expect(result).toBe(mockChainService);
      expect(chainServiceFactory.getChainServiceWithProvider).toHaveBeenCalledWith(
        'ETH',
        'quicknode',
      );
    });
  });

  describe('getDefaultService', () => {
    it('應該使用默認提供者獲取鏈服務', async () => {
      // 設置模擬返回
      jest.spyOn(chainServiceFactory, 'getChainService').mockReturnValue(mockChainService);

      // 調用測試方法
      const result = service.getDefaultService('BSC');

      // 驗證結果
      expect(result).toBe(mockChainService);
      expect(chainServiceFactory.getChainService).toHaveBeenCalledWith('BSC');
    });
  });

  describe('isChainAvailable', () => {
    it('應該返回指定的鏈是否可用', async () => {
      // 設置模擬返回
      jest
        .spyOn(chainServiceFactory, 'isChainAvailable')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      // 調用測試方法
      const result1 = service.isChainAvailable('ETH');
      const result2 = service.isChainAvailable('UNKNOWN');

      // 驗證結果
      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(chainServiceFactory.isChainAvailable).toHaveBeenNthCalledWith(1, 'ETH');
      expect(chainServiceFactory.isChainAvailable).toHaveBeenNthCalledWith(2, 'UNKNOWN');
    });
  });

  describe('getAvailableChains', () => {
    it('應該返回所有可用的鏈名稱', async () => {
      // 設置模擬返回
      const chains = ['ETH', 'BSC', 'POLY'];
      jest.spyOn(chainServiceFactory, 'getAvailableChains').mockReturnValue(chains);

      // 調用測試方法
      const result = service.getAvailableChains();

      // 驗證結果
      expect(result).toEqual(chains);
      expect(chainServiceFactory.getAvailableChains).toHaveBeenCalled();
    });
  });
});
