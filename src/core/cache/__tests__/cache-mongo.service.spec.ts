import { Test, TestingModule } from '@nestjs/testing';
import { CacheMongoService } from '../cache-mongo.service';
import { CacheService } from '../cache.service';
import { CacheKeyService } from '../cache-key.service';
import { DbService } from '../../db/db.service';
import { NotificationService } from '../../../notification/notification.service';
import { ChainName } from '../../../chains/constants';
import { ProviderType } from '../../../providers/constants/blockchain-types';
import { NotificationEventType } from '../../../notification/notification.service';

describe('CacheMongoService', () => {
  let service: CacheMongoService;
  let cacheService: CacheService;
  let cacheKeyService: CacheKeyService;
  let dbService: DbService;
  let notificationService: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheMongoService,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            deleteByPattern: jest.fn(),
          },
        },
        {
          provide: CacheKeyService,
          useValue: {
            createPortfolioKey: jest.fn(),
            invalidateChainAddressCache: jest.fn(),
          },
        },
        {
          provide: DbService,
          useValue: {
            getPortfolioSnapshot: jest.fn(),
            invalidateAddressSnapshot: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            emitAddressCacheInvalidated: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CacheMongoService>(CacheMongoService);
    cacheService = module.get<CacheService>(CacheService);
    cacheKeyService = module.get<CacheKeyService>(CacheKeyService);
    dbService = module.get<DbService>(DbService);
    notificationService = module.get<NotificationService>(NotificationService);

    // 模擬 logger
    jest.spyOn(service['logger'], 'debug').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('應該被定義', () => {
    expect(service).toBeDefined();
  });

  describe('getPortfolioData', () => {
    it('應該從緩存返回數據（緩存命中）', async () => {
      // 準備
      const chain = ChainName.ETHEREUM;
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';
      const provider = ProviderType.ALCHEMY;
      const cacheKey = 'portfolio:ethereum:address:alchemy';
      const cachedData = {
        nativeBalance: { symbol: 'ETH', balance: '1000000000000000000', decimals: 18 },
        tokens: [],
        nfts: [],
        updatedAt: 1234567890,
      };

      // 模擬行為
      jest.spyOn(cacheKeyService, 'createPortfolioKey').mockReturnValue(cacheKey);
      jest.spyOn(cacheService, 'get').mockResolvedValue(cachedData);

      // 執行
      const result = await service.getPortfolioData(chain, chainId, address, provider);

      // 驗證
      expect(cacheKeyService.createPortfolioKey).toHaveBeenCalledWith(chain, address, provider);
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(cachedData);
      expect(dbService.getPortfolioSnapshot).not.toHaveBeenCalled();
    });

    it('應該從MongoDB中獲取數據（緩存未命中）', async () => {
      // 準備
      const chain = ChainName.ETHEREUM;
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';
      const provider = ProviderType.ALCHEMY;
      const cacheKey = 'portfolio:ethereum:address:alchemy';
      const mongoData = {
        native: {
          symbol: 'ETH',
          balance: '1000000000000000000',
          decimals: 18,
          usd: 2000,
        },
        fungibles: [
          {
            address: '0xtoken',
            symbol: 'TOKEN',
            name: 'Test Token',
            balance: '1000000',
            decimals: 6,
            usd: 1000,
            logo: 'logo.png',
          },
        ],
        nfts: [],
      };

      // 模擬行為
      jest.spyOn(cacheKeyService, 'createPortfolioKey').mockReturnValue(cacheKey);
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(dbService, 'getPortfolioSnapshot').mockResolvedValue(mongoData as any);
      jest.spyOn(cacheService, 'set').mockResolvedValue();

      // 執行
      const result = await service.getPortfolioData(chain, chainId, address, provider);

      // 驗證
      expect(cacheKeyService.createPortfolioKey).toHaveBeenCalledWith(chain, address, provider);
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(dbService.getPortfolioSnapshot).toHaveBeenCalledWith(chainId, address, provider);
      expect(cacheService.set).toHaveBeenCalled();

      // 檢查結果格式
      expect(result).toBeDefined();
      expect(result?.nativeBalance).toEqual({
        symbol: 'ETH',
        balance: '1000000000000000000',
        decimals: 18,
        usd: 2000,
      });
      expect(result?.tokens).toHaveLength(1);
      expect(result?.tokens?.[0]).toEqual({
        address: '0xtoken',
        symbol: 'TOKEN',
        name: 'Test Token',
        balance: '1000000',
        decimals: 6,
        usd: 1000,
        logo: 'logo.png',
      });
    });

    it('應該在MongoDB中沒有數據時返回null', async () => {
      // 準備
      const chain = ChainName.ETHEREUM;
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';
      const cacheKey = 'portfolio:ethereum:address';

      // 模擬行為
      jest.spyOn(cacheKeyService, 'createPortfolioKey').mockReturnValue(cacheKey);
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(dbService, 'getPortfolioSnapshot').mockResolvedValue(null);

      // 執行
      const result = await service.getPortfolioData(chain, chainId, address);

      // 驗證
      expect(result).toBeNull();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('應該處理錯誤', async () => {
      // 準備
      const chain = ChainName.ETHEREUM;
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';
      const error = new Error('Test error');

      // 模擬行為
      jest.spyOn(cacheKeyService, 'createPortfolioKey').mockImplementation(() => {
        throw error;
      });

      // 執行 & 驗證
      await expect(service.getPortfolioData(chain, chainId, address)).rejects.toThrow(error);
    });
  });

  describe('invalidateAddressCache', () => {
    it('應該使Redis和MongoDB中的地址緩存失效', async () => {
      // 準備
      const chain = ChainName.ETHEREUM;
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';
      const pattern = 'portfolio:ethereum:1:0x1234567890123456789012345678901234567890:*';

      // 模擬行為
      jest.spyOn(cacheService, 'deleteByPattern').mockResolvedValue(3);
      jest.spyOn(dbService, 'invalidateAddressSnapshot').mockResolvedValue(1);

      // 執行
      const result = await service.invalidateAddressCache(chain, chainId, address);

      // 驗證
      expect(cacheService.deleteByPattern).toHaveBeenCalledWith(pattern);
      expect(dbService.invalidateAddressSnapshot).toHaveBeenCalledWith(chain, chainId, address);
      expect(result).toBe(3);
    });

    it('應該處理錯誤', async () => {
      // 準備
      const chain = ChainName.ETHEREUM;
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';
      const error = new Error('Test error');

      // 模擬行為
      jest.spyOn(cacheService, 'deleteByPattern').mockImplementation(() => {
        throw error;
      });

      // 執行 & 驗證
      await expect(service.invalidateAddressCache(chain, chainId, address)).rejects.toThrow(error);
    });
  });

  describe('handleAddressActivity', () => {
    it('應該處理地址活動事件並使緩存失效', async () => {
      // 準備
      const event = {
        type: NotificationEventType.ADDRESS_ACTIVITY,
        chain: ChainName.ETHEREUM,
        chainId: 1,
        address: '0x1234567890123456789012345678901234567890',
        metadata: { action: 'transfer' },
        timestamp: new Date(),
      };

      // 模擬行為
      jest.spyOn(dbService, 'invalidateAddressSnapshot').mockResolvedValue(1);
      jest.spyOn(cacheKeyService, 'invalidateChainAddressCache').mockResolvedValue(3);
      jest.spyOn(notificationService, 'emitAddressCacheInvalidated').mockResolvedValue();

      // 執行
      await service.handleAddressActivity(event);

      // 驗證
      expect(dbService.invalidateAddressSnapshot).toHaveBeenCalledWith(
        event.chain,
        event.chainId,
        event.address,
      );
      expect(cacheKeyService.invalidateChainAddressCache).toHaveBeenCalledWith(
        event.chain,
        event.chainId,
        event.address,
      );
      expect(notificationService.emitAddressCacheInvalidated).toHaveBeenCalledWith(
        event.chain,
        event.chainId,
        event.address,
      );
    });

    it('應該跳過處理已標記為 cache_invalidated 的事件', async () => {
      // 準備
      const event = {
        type: NotificationEventType.ADDRESS_ACTIVITY,
        chain: ChainName.ETHEREUM,
        chainId: 1,
        address: '0x1234567890123456789012345678901234567890',
        metadata: { action: 'cache_invalidated' },
        timestamp: new Date(),
      };

      // 執行
      await service.handleAddressActivity(event);

      // 驗證
      expect(dbService.invalidateAddressSnapshot).not.toHaveBeenCalled();
      expect(cacheKeyService.invalidateChainAddressCache).not.toHaveBeenCalled();
      expect(notificationService.emitAddressCacheInvalidated).not.toHaveBeenCalled();
    });

    it('應該處理 Redis 失敗但繼續 MongoDB 操作', async () => {
      // 準備
      const event = {
        type: NotificationEventType.ADDRESS_ACTIVITY,
        chain: ChainName.ETHEREUM,
        chainId: 1,
        address: '0x1234567890123456789012345678901234567890',
        metadata: { action: 'transfer' },
        timestamp: new Date(),
      };
      const error = new Error('Redis error');

      // 模擬行為
      jest.spyOn(dbService, 'invalidateAddressSnapshot').mockResolvedValue(1);
      jest.spyOn(cacheKeyService, 'invalidateChainAddressCache').mockRejectedValue(error);
      jest.spyOn(notificationService, 'emitAddressCacheInvalidated').mockResolvedValue();

      // 執行
      await service.handleAddressActivity(event);

      // 驗證
      expect(dbService.invalidateAddressSnapshot).toHaveBeenCalled();
      expect(notificationService.emitAddressCacheInvalidated).toHaveBeenCalled();
    });
  });
});
