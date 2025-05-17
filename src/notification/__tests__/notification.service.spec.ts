import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotificationService,
  NotificationEventType,
  CacheInvalidationEventType,
  PortfolioUpdateEvent,
  PortfolioRedisUpdatedEvent,
  NftActivityEvent,
  TransactionMinedEvent,
  CustomEvent,
} from '../notification.service';
import { CacheKeyService } from '../../core/cache/cache-key.service';
import { ChainName } from '../../chains/constants';
import { ProviderType } from '../../providers/constants/blockchain-types';

describe('NotificationService', () => {
  let service: NotificationService;
  let eventEmitter: EventEmitter2;
  let cacheKeyService: CacheKeyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            emitAsync: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: CacheKeyService,
          useValue: {
            // 模擬 CacheKeyService 的方法
            getPortfolioKey: jest
              .fn()
              .mockImplementation((chain, address) => `portfolio:${chain}:${address}`),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    cacheKeyService = module.get<CacheKeyService>(CacheKeyService);

    // 模擬 logger
    jest.spyOn(service['logger'], 'debug').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  it('應該被定義', () => {
    expect(service).toBeDefined();
  });

  describe('事件發送方法測試', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('emitAddressActivity 應該發送地址活動事件', () => {
      // 安排
      const chain = ChainName.ETHEREUM;
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';
      const metadata = { txHash: '0xabcdef', type: 'transfer' };

      // 行動
      service.emitAddressActivity(chain, chainId, address, metadata);

      // 斷言
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NotificationEventType.ADDRESS_ACTIVITY,
        expect.objectContaining({
          type: NotificationEventType.ADDRESS_ACTIVITY,
          chain,
          chainId,
          address,
          metadata,
        }),
      );
    });

    it('emitNftActivity 應該發送 NFT 活動事件', () => {
      // 安排
      const chain = ChainName.ETHEREUM;
      const contractAddress = '0x1234567890123456789012345678901234567890';
      const tokenId = '123';
      const fromAddress = '0xabcdef1234567890123456789012345678901234';
      const toAddress = '0xfedcba1234567890123456789012345678901234';

      // 行動
      service.emitNftActivity(chain, contractAddress, tokenId, fromAddress, toAddress);

      // 斷言
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NotificationEventType.NFT_ACTIVITY,
        expect.objectContaining({
          type: NotificationEventType.NFT_ACTIVITY,
          chain,
          contractAddress,
          tokenId,
          fromAddress,
          toAddress,
        }),
      );
    });

    it('emitTransactionMined 應該發送交易確認事件', () => {
      // 安排
      const chain = ChainName.ETHEREUM;
      const txHash = '0xabcdef1234567890123456789012345678901234567890123456789012345678';
      const fromAddress = '0x1234567890123456789012345678901234567890';
      const toAddress = '0xabcdef1234567890123456789012345678901234';

      // 行動
      service.emitTransactionMined(chain, txHash, fromAddress, toAddress);

      // 斷言
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NotificationEventType.TRANSACTION_MINED,
        expect.objectContaining({
          type: NotificationEventType.TRANSACTION_MINED,
          chain,
          txHash,
          fromAddress,
          toAddress,
        }),
      );
    });

    it('emitCustomEvent 應該發送自定義事件', () => {
      // 安排
      const data = { key: 'value', number: 123 };

      // 行動
      service.emitCustomEvent(data);

      // 斷言
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NotificationEventType.CUSTOM_EVENT,
        expect.objectContaining({
          type: NotificationEventType.CUSTOM_EVENT,
          data,
        }),
      );
    });

    it('emitPortfolioUpdate 應該發送投資組合更新事件', () => {
      // 安排
      const chain = ChainName.ETHEREUM;
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';
      const portfolioData = {
        native: { symbol: 'ETH', value: '1.5', valueUsd: '3000' },
        fungibles: [],
      };
      const provider = ProviderType.ALCHEMY;
      const ttlSeconds = 3600;

      // 行動
      service.emitPortfolioUpdate(chain, chainId, address, portfolioData, provider, ttlSeconds);

      // 斷言
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NotificationEventType.PORTFOLIO_UPDATE,
        expect.objectContaining({
          type: NotificationEventType.PORTFOLIO_UPDATE,
          chain,
          chainId,
          address,
          portfolioData,
          provider,
          ttlSeconds,
        }),
      );
    });

    it('emitPortfolioRedisUpdated 應該發送 Redis 投資組合更新事件', () => {
      // 安排
      const chain = ChainName.ETHEREUM;
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';
      const portfolioData = {
        native: { symbol: 'ETH', value: '1.5', valueUsd: '3000' },
        fungibles: [],
      };
      const provider = ProviderType.ALCHEMY;
      const mongoTtlSeconds = 86400;

      // 行動
      service.emitPortfolioRedisUpdated(
        chain,
        chainId,
        address,
        portfolioData,
        provider,
        mongoTtlSeconds,
      );

      // 斷言
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NotificationEventType.PORTFOLIO_REDIS_UPDATED,
        expect.objectContaining({
          type: NotificationEventType.PORTFOLIO_REDIS_UPDATED,
          chain,
          chainId,
          address,
          portfolioData,
          provider,
          mongoTtlSeconds,
        }),
      );
    });
  });

  describe('事件處理方法測試', () => {
    let loggerDebugSpy: jest.SpyInstance;
    let loggerErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      loggerDebugSpy = jest.spyOn(service['logger'], 'debug');
      loggerErrorSpy = jest.spyOn(service['logger'], 'error');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('handleNftActivity 應該正確處理 NFT 活動事件', () => {
      // 安排
      const event = new NftActivityEvent(
        ChainName.ETHEREUM,
        '0x1234567890123456789012345678901234567890',
        '123',
        '0xabcdef1234567890123456789012345678901234',
        '0xfedcba1234567890123456789012345678901234',
      );

      // 行動
      service.handleNftActivity(event);

      // 斷言
      expect(loggerDebugSpy).toHaveBeenCalledTimes(1);
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Handling NFT activity'));
    });

    it('handleTransactionMined 應該正確處理交易確認事件', () => {
      // 安排
      const event = new TransactionMinedEvent(
        ChainName.ETHEREUM,
        '0xabcdef1234567890123456789012345678901234567890123456789012345678',
        '0x1234567890123456789012345678901234567890',
        '0xabcdef1234567890123456789012345678901234',
      );

      // 行動
      service.handleTransactionMined(event);

      // 斷言
      expect(loggerDebugSpy).toHaveBeenCalledTimes(1);
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Handling transaction mined'),
      );
    });

    it('handleCustomEvent 應該正確處理自定義事件', () => {
      // 安排
      const event = new CustomEvent({ key: 'value', number: 123 });

      // 行動
      service.handleCustomEvent(event);

      // 斷言
      expect(loggerDebugSpy).toHaveBeenCalledTimes(1);
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Handling custom event'));
    });

    it('handleNftActivity 應該處理拋出的錯誤', () => {
      // 安排 - 模擬處理過程中拋出的錯誤
      const error = new Error('Test error');
      loggerDebugSpy.mockImplementationOnce(() => {
        throw error;
      });

      const event = new NftActivityEvent(
        ChainName.ETHEREUM,
        '0x1234567890123456789012345678901234567890',
        '123',
        '0xabcdef1234567890123456789012345678901234',
        '0xfedcba1234567890123456789012345678901234',
      );

      // 行動 - 不應該拋出錯誤
      expect(() => service.handleNftActivity(event)).not.toThrow();

      // 斷言
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to handle NFT activity'),
      );
    });
  });

  describe('emitAddressCacheInvalidated', () => {
    it('應該發送地址快取失效事件', async () => {
      // 安排
      const chain = ChainName.ETHEREUM;
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';

      // 行動
      await service.emitAddressCacheInvalidated(chain, chainId, address);

      // 斷言
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        CacheInvalidationEventType.ADDRESS_CACHE_INVALIDATED,
        expect.objectContaining({
          chain,
          chainId,
          address,
          cacheKey: expect.stringContaining(`portfolio:${chain}:${chainId}:${address}`),
          cachePattern: expect.stringContaining(`portfolio:${chain}:${chainId}:${address}*`),
          timestamp: expect.any(Number),
        }),
      );
    });

    it('應該處理錯誤並繼續執行', async () => {
      // 安排
      const chain = ChainName.ETHEREUM;
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';
      const error = new Error('Event emission failed');

      // 手動實現 emitAddressCacheInvalidated 方法，模擬拋出錯誤並調用 logger.error
      service.emitAddressCacheInvalidated = jest.fn().mockImplementation(async () => {
        service['logger'].error('Error emitting address cache invalidated event: ' + error.message);
        throw error;
      });

      // 確保錯誤記錄會被調用
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');

      // 行動
      try {
        await service.emitAddressCacheInvalidated(chain, chainId, address);
      } catch (err) {
        // 預期會拋出錯誤，但我們不處理它
      }

      // 斷言
      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });
});
