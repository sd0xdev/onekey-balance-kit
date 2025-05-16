import { Test, TestingModule } from '@nestjs/testing';
import { CacheKeyService, CacheKeyPrefix } from './cache-key.service';
import { ChainName, CHAIN_INFO_MAP } from '../../chains/constants';
import { ProviderType } from '../../providers/constants/blockchain-types';
import { CacheService } from './cache.service';
import { Logger } from '@nestjs/common';

// 創建模擬 CacheService
const mockCacheService = {
  deleteByPattern: jest.fn().mockResolvedValue(5), // 模擬刪除 5 個項目
};

// 創建模擬 Logger
const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('CacheKeyService', () => {
  let service: CacheKeyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheKeyService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<CacheKeyService>(CacheKeyService);
    // 在每個測試前重置 mock
    jest.clearAllMocks();

    // 替換 Logger 實例
    (service as any).logger = mockLogger;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateKey', () => {
    it('should generate key with all components', () => {
      const components = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
        chainId: 1,
        address: '0x1234567890',
        provider: ProviderType.ALCHEMY,
        extra: ['token', 'test'],
      };

      const expectedKey = 'portfolio:ethereum:1:0x1234567890:alchemy:token:test';
      expect(service.generateKey(components)).toBe(expectedKey);
    });

    it('should generate key without optional components', () => {
      const components = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
      };

      // 使用 CHAIN_INFO_MAP 的默認鏈 ID
      const expectedKey = `portfolio:ethereum:${CHAIN_INFO_MAP[ChainName.ETHEREUM].id}`;
      expect(service.generateKey(components)).toBe(expectedKey);
    });

    it('should generate key with address but without chainId', () => {
      const components = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
        address: '0x1234567890',
      };

      const expectedKey = `portfolio:ethereum:${CHAIN_INFO_MAP[ChainName.ETHEREUM].id}:0x1234567890`;
      expect(service.generateKey(components)).toBe(expectedKey);
    });

    it('should generate key with provider but without address', () => {
      const components = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
        provider: ProviderType.ALCHEMY,
      };

      const expectedKey = `portfolio:ethereum:${CHAIN_INFO_MAP[ChainName.ETHEREUM].id}:${ProviderType.ALCHEMY}`;
      expect(service.generateKey(components)).toBe(expectedKey);
    });

    it('should handle empty extra array', () => {
      const components = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
        chainId: 1,
        address: '0x1234567890',
        provider: ProviderType.ALCHEMY,
        extra: [],
      };

      const expectedKey = 'portfolio:ethereum:1:0x1234567890:alchemy';
      expect(service.generateKey(components)).toBe(expectedKey);
    });

    it('should use explicit chainId over inferred from CHAIN_INFO_MAP', () => {
      const components = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
        chainId: 11155111, // Sepolia testnet
        address: '0x1234567890',
      };

      const expectedKey = 'portfolio:ethereum:11155111:0x1234567890';
      expect(service.generateKey(components)).toBe(expectedKey);
    });
  });

  describe('parseKey', () => {
    it('should parse key with all components', () => {
      const key = 'portfolio:ethereum:1:0x1234567890:alchemy:token:test';
      const expected = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
        chainId: 1,
        address: '0x1234567890',
        provider: ProviderType.ALCHEMY,
        extra: ['token', 'test'],
      };

      expect(service.parseKey(key)).toEqual(expected);
    });

    it('should parse key without chain id', () => {
      const key = 'portfolio:ethereum:0x1234567890:alchemy';
      const expected = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
        address: '0x1234567890',
        provider: ProviderType.ALCHEMY,
      };

      expect(service.parseKey(key)).toEqual(expected);
    });

    it('should return empty object for invalid key', () => {
      const key = 'invalid';
      expect(service.parseKey(key)).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(`Invalid cache key format: ${key}`);
    });

    it('should handle keys with only prefix and chain', () => {
      const key = 'portfolio:ethereum';
      const expected = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
      };

      expect(service.parseKey(key)).toEqual(expected);
    });

    it('should correctly distinguish between keys with and without chainId', () => {
      // Key with numeric chainId
      const keyWithChainId = 'portfolio:ethereum:1:0x1234567890';
      const expectedWithChainId = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
        chainId: 1,
        address: '0x1234567890',
      };
      expect(service.parseKey(keyWithChainId)).toEqual(expectedWithChainId);

      // Key with non-numeric part after chain (treated as address)
      const keyWithoutChainId = 'portfolio:ethereum:0x1234567890';
      const expectedWithoutChainId = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
        address: '0x1234567890',
      };
      expect(service.parseKey(keyWithoutChainId)).toEqual(expectedWithoutChainId);
    });
  });

  describe('createPortfolioKey', () => {
    it('should create portfolio key with all parameters', () => {
      const expectedKey = `portfolio:ethereum:${CHAIN_INFO_MAP[ChainName.ETHEREUM].id}:0x1234567890:alchemy`;
      expect(
        service.createPortfolioKey(ChainName.ETHEREUM, '0x1234567890', ProviderType.ALCHEMY),
      ).toBe(expectedKey);
    });

    it('should create portfolio key without provider', () => {
      const expectedKey = `portfolio:ethereum:${CHAIN_INFO_MAP[ChainName.ETHEREUM].id}:0x1234567890`;
      expect(service.createPortfolioKey(ChainName.ETHEREUM, '0x1234567890')).toBe(expectedKey);
    });

    it('should create consistent keys for the same inputs', () => {
      const key1 = service.createPortfolioKey(ChainName.ETHEREUM, '0x1234567890');
      const key2 = service.createPortfolioKey(ChainName.ETHEREUM, '0x1234567890');
      expect(key1).toBe(key2);
    });
  });

  describe('invalidation methods', () => {
    it('should invalidate address cache', async () => {
      const pattern = `portfolio:ethereum:*:0x1234567890*`;
      await service.invalidateAddressCache(ChainName.ETHEREUM, '0x1234567890');
      expect(mockCacheService.deleteByPattern).toHaveBeenCalledWith(pattern);
      expect(mockLogger.debug).toHaveBeenCalledWith(`Invalidating cache with pattern: ${pattern}`);
    });

    it('should invalidate chain address cache', async () => {
      const pattern = `portfolio:ethereum:1:0x1234567890*`;
      await service.invalidateChainAddressCache(ChainName.ETHEREUM, 1, '0x1234567890');
      expect(mockCacheService.deleteByPattern).toHaveBeenCalledWith(pattern);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Invalidating chain address cache with pattern: ${pattern}`,
      );
    });

    it('should invalidate provider cache', async () => {
      const pattern = `*:*:*:*:alchemy`;
      await service.invalidateProviderCache(ProviderType.ALCHEMY);
      expect(mockCacheService.deleteByPattern).toHaveBeenCalledWith(pattern);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Invalidating provider cache with pattern: ${pattern}`,
      );
    });

    it('should return the number of deleted entries', async () => {
      const result = await service.invalidateAddressCache(ChainName.ETHEREUM, '0x1234567890');
      expect(result).toBe(5); // 模擬的回傳值
    });

    it('should handle errors from cacheService.deleteByPattern', async () => {
      // 模擬錯誤情況
      mockCacheService.deleteByPattern.mockRejectedValueOnce(new Error('Redis connection error'));

      // 確保錯誤會被正確傳播
      await expect(
        service.invalidateAddressCache(ChainName.ETHEREUM, '0x1234567890'),
      ).rejects.toThrow('Redis connection error');
    });
  });

  // 測試方法網路整合
  describe('method integrations', () => {
    it('should generate and parse the same key correctly', () => {
      const components = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
        chainId: 1,
        address: '0x1234567890',
        provider: ProviderType.ALCHEMY,
        extra: ['token', 'test'],
      };

      const key = service.generateKey(components);
      const parsed = service.parseKey(key);
      expect(parsed).toEqual(components);
    });

    it('should use chainId from generateKey in parseKey', () => {
      const components = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
        address: '0x1234567890',
        provider: ProviderType.ALCHEMY,
      };

      const key = service.generateKey(components);
      const parsed = service.parseKey(key);

      // 查驗解析後的鍵包含自動加入的鏈ID
      expect(parsed.chainId).toBe(CHAIN_INFO_MAP[ChainName.ETHEREUM].id);
    });

    it('should work with different chain types', () => {
      // 測試以太坊
      const ethKey = service.createPortfolioKey(ChainName.ETHEREUM, '0xETH');
      expect(ethKey).toContain('ethereum');
      expect(service.parseKey(ethKey).chain).toBe(ChainName.ETHEREUM);

      // 測試 Solana
      const solKey = service.createPortfolioKey(ChainName.SOLANA, 'SOL_ADDR');
      expect(solKey).toContain('solana');
      expect(service.parseKey(solKey).chain).toBe(ChainName.SOLANA);
    });

    it('should handle keys with multiple extra components correctly', () => {
      const components = {
        prefix: CacheKeyPrefix.PORTFOLIO,
        chain: ChainName.ETHEREUM,
        chainId: 1,
        address: '0x1234567890',
        extra: ['token', 'balance', 'USD', 'latest'],
      };

      const key = service.generateKey(components);
      const parsed = service.parseKey(key);

      expect(parsed.extra).toHaveLength(4);
      expect(parsed.extra).toEqual(['token', 'balance', 'USD', 'latest']);
    });
  });
});
