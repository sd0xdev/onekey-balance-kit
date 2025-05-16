import { Test, TestingModule } from '@nestjs/testing';
import { BalanceService } from './balance.service';
import { CacheMongoService } from '../../core/cache/cache-mongo.service';
import { ChainServiceFactory } from '../../chains/services/core/chain-service.factory';
import { NotificationService } from '../../notification/notification.service';
import { ChainName, CHAIN_INFO_MAP } from '../../chains/constants';
import {
  BalanceException,
  BlockchainException,
} from '../../common/exceptions/application.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { ProviderType } from '../../providers/constants/blockchain-types';

// 添加類型聲明來避免TypeScript錯誤
type MockFunction<T extends (...args: any) => any> = jest.Mock<ReturnType<T>, Parameters<T>>;

describe('BalanceService', () => {
  let service: BalanceService;
  let cacheMongoService: CacheMongoService;
  let chainServiceFactory: ChainServiceFactory;
  let notificationService: NotificationService;

  // 模擬鏈服務
  const mockChainService = {
    getChainName: jest.fn().mockReturnValue('ethereum'),
    getChainSymbol: jest.fn().mockReturnValue('ETH'),
    isValidAddress: jest.fn().mockReturnValue(true),
    getBalances: jest.fn(),
  };

  // 模擬請求對象
  const mockRequest = {
    blockchainProvider: 'alchemy',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: CacheMongoService,
          useValue: {
            getPortfolioData: jest.fn(),
          },
        },
        {
          provide: ChainServiceFactory,
          useValue: {
            getChainService: jest.fn().mockReturnValue(mockChainService),
            getChainServiceWithProvider: jest.fn().mockReturnValue(mockChainService),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            emitPortfolioUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = await module.resolve<BalanceService>(BalanceService);
    cacheMongoService = module.get<CacheMongoService>(CacheMongoService);
    chainServiceFactory = module.get<ChainServiceFactory>(ChainServiceFactory);
    notificationService = module.get<NotificationService>(NotificationService);

    // 私有屬性注入
    Object.defineProperty(service, 'request', {
      value: mockRequest,
      writable: true,
    });

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('normalizeChainInput', () => {
    it('should return chain name if input is valid ChainName', async () => {
      const result = await (service as any).normalizeChainInput('ethereum');
      expect(result).toBe('ethereum');
    });

    it('should return chain name if input is valid coin symbol', async () => {
      const result = await (service as any).normalizeChainInput('eth');
      expect(result).toBe('ethereum');
    });

    it('should throw exception if chain is not supported', async () => {
      try {
        await (service as any).normalizeChainInput('invalidChain');
        fail('應該拋出例外');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.errorCode).toBe(ErrorCode.BALANCE_CHAIN_NOT_SUPPORTED);
      }
    });
  });

  describe('getProviderFromContext', () => {
    it('should return provider from request context', () => {
      const provider = (service as any).getProviderFromContext();
      expect(provider).toBe('alchemy');
    });

    it('should return undefined if no provider in context', () => {
      Object.defineProperty(service, 'request', {
        value: {},
        writable: true,
      });
      const provider = (service as any).getProviderFromContext();
      expect(provider).toBeUndefined();
    });
  });

  describe('getPortfolio', () => {
    const address = '0x123456789abcdef';
    const chainName = 'ethereum';
    const chainId = CHAIN_INFO_MAP[ChainName.ETHEREUM].id;
    const mockBalanceData = {
      updatedAt: 1234567890,
      nativeBalance: {
        symbol: 'ETH',
        decimals: 18,
        balance: '1000000000000000000',
        usd: 2000,
      },
      tokens: [],
      nfts: [],
    };

    it('should return cached data if available', async () => {
      jest.spyOn(cacheMongoService, 'getPortfolioData').mockResolvedValue(mockBalanceData);

      const result = await service.getPortfolio(chainName, address);

      expect((cacheMongoService.getPortfolioData as any).mock.calls[0]).toEqual([
        'ethereum',
        chainId,
        address,
        'alchemy',
      ]);
      expect(result).toEqual(mockBalanceData);
      expect((chainServiceFactory.getChainServiceWithProvider as any).mock.calls.length).toBe(0);
      expect((chainServiceFactory.getChainService as any).mock.calls.length).toBe(0);
    });

    it('should fetch data from blockchain if cache misses', async () => {
      jest.spyOn(cacheMongoService, 'getPortfolioData').mockResolvedValue(null);
      jest.spyOn(mockChainService, 'getBalances').mockResolvedValue(mockBalanceData);

      const result = await service.getPortfolio(chainName, address);

      expect((cacheMongoService.getPortfolioData as any).mock.calls.length).toBeGreaterThan(0);

      expect((chainServiceFactory.getChainServiceWithProvider as any).mock.calls[0]).toEqual([
        'ethereum',
        'alchemy',
      ]);
      expect((mockChainService.isValidAddress as any).mock.calls[0]).toEqual([address]);
      expect((mockChainService.getBalances as any).mock.calls[0]).toEqual([
        address,
        chainId,
        'alchemy',
      ]);

      expect((notificationService.emitPortfolioUpdate as any).mock.calls.length).toBeGreaterThan(0);
      expect(result).toEqual({
        nativeBalance: expect.objectContaining({
          symbol: expect.any(String),
          decimals: expect.any(Number),
          balance: expect.any(String),
        }),
        tokens: expect.any(Array),
        nfts: expect.any(Array),
        updatedAt: expect.any(Number),
      });
    });

    it('should throw error if address is invalid', async () => {
      jest.spyOn(cacheMongoService, 'getPortfolioData').mockResolvedValue(null);
      jest.spyOn(mockChainService, 'isValidAddress').mockReturnValue(false);

      await expect(service.getPortfolio(chainName, address)).rejects.toThrow(BlockchainException);
      expect(mockChainService.getBalances).not.toHaveBeenCalled();
    });

    it('should throw error if chain is not supported', async () => {
      await expect(service.getPortfolio('unsupportedChain', address)).rejects.toThrow(
        BalanceException,
      );
    });

    it('should use standard getChainService if no provider in context', async () => {
      Object.defineProperty(service, 'request', {
        value: {},
        writable: true,
      });

      jest.spyOn(cacheMongoService, 'getPortfolioData').mockResolvedValue(null);

      // 模擬地址是無效的，這樣就會拋出異常
      jest.spyOn(mockChainService, 'isValidAddress').mockReturnValue(false);

      try {
        await service.getPortfolio(chainName, address);
        fail('應該因為地址無效而拋出例外');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.errorCode).toBe(ErrorCode.BLOCKCHAIN_INVALID_ADDRESS);
      }

      expect((chainServiceFactory.getChainService as any).mock.calls[0]).toEqual(['ethereum']);

      expect((chainServiceFactory.getChainServiceWithProvider as any).mock.calls.length).toBe(0);
    });
  });
});
