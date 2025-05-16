import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { AppConfigService } from '../../config/config.service';

// 模擬 Redis 客戶端
const createMockRedisClient = () => ({
  scan: jest.fn().mockResolvedValue({ cursor: '0', keys: ['test:key1', 'test:key2'] }),
  unlink: jest.fn().mockResolvedValue(2),
  ping: jest.fn().mockResolvedValue('PONG'),
  isOpen: true,
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(true),
  quit: jest.fn().mockResolvedValue('OK'),
});

describe('CacheService', () => {
  let service: CacheService;
  let mockCacheManager: any;
  let mockRedisClient: any;
  let originalEnv: NodeJS.ProcessEnv;

  // 保存原始環境變數
  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  // 還原環境變數
  afterAll(() => {
    process.env = originalEnv;
  });

  // 基本記憶體快取模式設置
  const setupMemoryCacheTest = async (ttl?: string) => {
    if (ttl) {
      process.env.CACHE_TTL = ttl;
    } else {
      process.env.CACHE_TTL = '500';
    }

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      reset: jest.fn(),
      stores: [],
      isRedisStore: false,
    };

    const mockAppConfigService = {
      redis: null,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: AppConfigService, useValue: mockAppConfigService },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});

    return service;
  };

  // Redis 快取模式設置
  const setupRedisCacheTest = async () => {
    process.env.CACHE_TTL = '600';
    mockRedisClient = createMockRedisClient();
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      reset: jest.fn(),
      stores: [
        {
          opts: {
            store: {
              _redis: mockRedisClient,
            },
          },
        },
      ],
      isRedisStore: true,
    };

    const mockAppConfigService = {
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: AppConfigService, useValue: mockAppConfigService },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});

    return service;
  };

  // 每次測試後清除 mock
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('記憶體快取模式', () => {
    beforeEach(async () => {
      await setupMemoryCacheTest();
    });

    it('應該正確初始化', () => {
      expect(service).toBeDefined();
      expect(service.getCacheType()).toBe('Memory');
    });

    it('get 方法應該從快取中獲取數據', async () => {
      const mockData = { test: 'data' };
      mockCacheManager.get.mockResolvedValue(mockData);

      const result = await service.get('test-key');
      expect(result).toEqual(mockData);
      expect(mockCacheManager.get).toHaveBeenCalledWith('test-key');
    });

    it('get 方法在出錯時應該返回 null', async () => {
      mockCacheManager.get.mockRejectedValue(new Error('Cache error'));

      try {
        await service.get('test-key');
        fail('應該拋出例外');
      } catch (err) {
        expect(err.message).toContain('獲取快取失敗');
      }
    });

    it('set 方法應該使用預設 TTL 設置快取', async () => {
      await service.set('test-key', 'test-value');
      expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', 'test-value', 500 * 1000);
    });

    it('set 方法應該使用指定的 TTL 設置快取', async () => {
      await service.set('test-key', 'test-value', 100);
      expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', 'test-value', 100 * 1000);
    });

    it('set 方法在出錯時應該正確處理', async () => {
      mockCacheManager.set.mockRejectedValue(new Error('Cache set error'));

      try {
        await service.set('test-key', 'test-value');
        fail('應該拋出例外');
      } catch (err) {
        expect(err.message).toContain('設置快取失敗');
      }
    });

    it('delete 方法應該刪除快取', async () => {
      await service.delete('test-key');
      expect(mockCacheManager.del).toHaveBeenCalledWith('test-key');
    });

    it('delete 方法在出錯時應該正確處理', async () => {
      mockCacheManager.del.mockRejectedValue(new Error('Cache delete error'));

      try {
        await service.delete('test-key');
        fail('應該拋出例外');
      } catch (err) {
        expect(err.message).toContain('設置快取失敗');
      }
    });

    it('deleteByPattern 方法在記憶體模式下應該返回 0', async () => {
      const result = await service.deleteByPattern('test:*');
      expect(result).toBe(0);
    });

    it('reset 方法應該清空所有快取', async () => {
      await service.reset();
      expect(mockCacheManager.reset).toHaveBeenCalled();
    });
  });

  describe('Redis 快取模式', () => {
    beforeEach(async () => {
      await setupRedisCacheTest();
    });

    it('應該正確初始化', () => {
      expect(service).toBeDefined();
      expect(service.getCacheType()).toBe('Redis');
    });

    it('get 方法應該從 Redis 快取中獲取數據', async () => {
      const mockData = { test: 'redis-data' };
      mockCacheManager.get.mockResolvedValue(mockData);

      const result = await service.get('test-key');
      expect(result).toEqual(mockData);
      expect(mockCacheManager.get).toHaveBeenCalledWith('test-key');
    });

    it('deleteByPattern 方法應該使用 Redis SCAN + UNLINK 刪除符合模式的鍵', async () => {
      const result = await service.deleteByPattern('test:*');

      expect(mockRedisClient.scan).toHaveBeenCalledWith('0', {
        MATCH: 'test:*',
        COUNT: 100,
      });
      expect(mockRedisClient.unlink).toHaveBeenCalledWith(['test:key1', 'test:key2']);
      expect(result).toBe(2);
    });

    it('當 Redis 客戶端關閉時，deleteByPattern 方法應嘗試重新連接', async () => {
      mockRedisClient.isOpen = false;

      const result = await service.deleteByPattern('test:*');

      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.scan).toHaveBeenCalled();
      expect(result).toBe(2);
    });

    it('isRedisConnected 方法應該正確檢測 Redis 連接狀態', async () => {
      const result = await service.isRedisConnected();
      expect(result).toBe(true);

      mockRedisClient.isOpen = false;
      const resultDisconnected = await service.isRedisConnected();
      expect(resultDisconnected).toBe(false);
    });
  });

  describe('環境變數配置', () => {
    it('應該使用環境變數中設置的 TTL', async () => {
      // 先清除環境變數
      delete process.env.CACHE_TTL;
      // 設定新值並驗證是否被正確使用
      process.env.CACHE_TTL = '1000';

      const ttlService = await Test.createTestingModule({
        providers: [
          CacheService,
          { provide: CACHE_MANAGER, useValue: mockCacheManager },
          { provide: AppConfigService, useValue: { redis: null } },
        ],
      })
        .compile()
        .then((module) => module.get<CacheService>(CacheService));

      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});

      await ttlService.set('test-key', 'test-value');
      expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', 'test-value', 1000 * 1000);
    });

    it('應該在未設置 TTL 環境變數時使用預設值 300', async () => {
      // 確保環境變數被清除
      delete process.env.CACHE_TTL;

      const defaultService = await Test.createTestingModule({
        providers: [
          CacheService,
          { provide: CACHE_MANAGER, useValue: mockCacheManager },
          { provide: AppConfigService, useValue: { redis: null } },
        ],
      })
        .compile()
        .then((module) => module.get<CacheService>(CacheService));

      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});

      await defaultService.set('test-key', 'test-value');
      expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', 'test-value', 300 * 1000);
    });
  });
});
