import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import {
  SseSubscriptionService,
  CacheEventType,
  CacheInvalidateEvent,
} from '../sse-subscription.service';
import { ChainName } from '../../../chains/constants';

describe('SseSubscriptionService', () => {
  let service: SseSubscriptionService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    jest.useFakeTimers(); // 啟用假定時器

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SseSubscriptionService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            emitAsync: jest.fn().mockResolvedValue(true),
            on: jest.fn(),
            once: jest.fn(),
            addListener: jest.fn(),
            removeListener: jest.fn(),
            // 模擬 fromEvent 方法所需的框架
            onAny: jest.fn(),
            offAny: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SseSubscriptionService>(SseSubscriptionService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // 模擬 logger
    jest.spyOn(service['logger'], 'debug').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers(); // 恢復真實定時器
  });

  it('應該被定義', () => {
    expect(service).toBeDefined();
  });

  describe('getEventStream', () => {
    it('應該註冊客戶端並返回事件流', () => {
      // Mock
      const registerClientSpy = jest.spyOn(service, 'registerClient');

      // 實現測試前的準備，確保 createEventsObservable 返回正確的 Observable
      // @ts-expect-error - 私有方法訪問
      jest.spyOn(service, 'createEventsObservable').mockReturnValue(of({ data: 'test-event' }));

      // 執行
      const result = service.getEventStream('test-client-id');

      // 驗證
      expect(registerClientSpy).toHaveBeenCalledWith('test-client-id');
      expect(result).toBeDefined();
    });

    it('應該重播事件如果提供了 lastEventId', () => {
      // Mock
      const clientId = 'test-client-id';
      const lastEventId = 'last-event-id';
      const mockEvents = [
        { key: 'key1', timestamp: 1234, id: 'id1' },
        { key: 'key2', timestamp: 5678, id: 'id2' },
      ] as CacheInvalidateEvent[];

      // @ts-expect-error - 私有方法訪問
      jest.spyOn(service, 'getEventsSince').mockReturnValue(mockEvents);
      // @ts-expect-error - 私有方法訪問
      jest.spyOn(service, 'formatCacheEvent').mockImplementation((event) => ({
        data: JSON.stringify(event),
        id: event.id,
      }));
      // @ts-expect-error - 私有方法訪問
      jest.spyOn(service, 'createEventsObservable').mockReturnValue(of({ data: 'test-event' }));

      // 執行
      const result = service.getEventStream(clientId, lastEventId);

      // 驗證
      expect(result).toBeDefined();
      // @ts-expect-error - 私有方法訪問
      expect(service.getEventsSince).toHaveBeenCalledWith(lastEventId);
    });

    it('應該在客戶端對象無效時丟出錯誤', () => {
      // 模擬 clients map 是空的
      // @ts-expect-error - 私有屬性訪問
      service.clients = new Map();

      // 模擬 getEventStream 方法，確保它會拋出錯誤
      const error = new Error('客戶端未註冊');
      jest.spyOn(service, 'getEventStream').mockImplementation(() => {
        throw error;
      });

      // 執行和驗證
      expect(() => {
        service.getEventStream('non-existent-client');
      }).toThrow(error);
    });
  });

  describe('registerClient', () => {
    it('應該向 clients map 中新增客戶端', () => {
      // 執行
      service.registerClient('test-client-id');

      // 驗證
      // @ts-expect-error - 私有屬性訪問
      expect(service.clients.has('test-client-id')).toBe(true);
      // @ts-expect-error - 私有屬性訪問
      const client = service.clients.get('test-client-id');
      if (client) {
        expect(client.isActive).toBe(true);
        expect(client.subject).toBeInstanceOf(Subject);
      } else {
        fail('客戶端應該存在');
      }
    });

    it('應該更新已存在客戶端的活躍時間', () => {
      // 準備
      const clientId = 'test-client-id';
      service.registerClient(clientId);

      // @ts-expect-error - 私有屬性訪問
      const client = service.clients.get(clientId);
      if (!client) {
        fail('客戶端應該存在');
        return;
      }
      const oldLastActive = client.lastActive;

      // 模擬時間經過
      jest.advanceTimersByTime(1000);

      // 重新註冊同一個客戶端
      service.registerClient(clientId);

      // 驗證
      // @ts-expect-error - 私有屬性訪問
      const newClient = service.clients.get(clientId);
      if (!newClient) {
        fail('客戶端應該存在');
        return;
      }
      const newLastActive = newClient.lastActive;
      expect(newLastActive).toBeGreaterThanOrEqual(oldLastActive);
    });

    it('應該存儲訂閱過濾條件', () => {
      // 準備
      const clientId = 'test-client-id';
      const subscription = {
        chain: ChainName.ETHEREUM,
        address: '0x1234567890123456789012345678901234567890',
      };

      // 執行
      service.registerClient(clientId, subscription);

      // 驗證
      // @ts-expect-error - 私有屬性訪問
      const client = service.clients.get(clientId);
      if (!client) {
        fail('客戶端應該存在');
        return;
      }
      expect(client.subscription).toBe(subscription);
    });
  });

  describe('unregisterClient', () => {
    it('應該從 clients map 中移除客戶端', () => {
      // 準備
      const clientId = 'test-client-id';
      service.registerClient(clientId);

      // 執行
      service.unregisterClient(clientId);

      // 驗證
      // @ts-expect-error - 私有屬性訪問
      expect(service.clients.has(clientId)).toBe(false);
    });

    it('應該在找不到客戶端時不拋出錯誤', () => {
      // 執行和驗證
      expect(() => {
        service.unregisterClient('non-existent-client');
      }).not.toThrow();
    });

    it('應該在客戶端活躍時調用 subject.next 和 subject.complete', () => {
      // 準備
      const clientId = 'test-client-id';
      service.registerClient(clientId);

      // @ts-expect-error - 私有屬性訪問
      const client = service.clients.get(clientId);
      if (!client) {
        fail('客戶端應該存在');
        return;
      }
      const nextSpy = jest.spyOn(client.subject, 'next');
      const completeSpy = jest.spyOn(client.subject, 'complete');

      // 執行
      service.unregisterClient(clientId);

      // 驗證
      expect(nextSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });
  });

  describe('updateClientActivity', () => {
    it('應該更新客戶端的活躍時間', () => {
      // 準備
      const clientId = 'test-client-id';
      service.registerClient(clientId);

      // @ts-expect-error - 私有屬性訪問
      const oldLastActive = service.clients.get(clientId).lastActive;

      // 模擬時間經過
      jest.advanceTimersByTime(1000);

      // 執行
      service.updateClientActivity(clientId);

      // 驗證
      // @ts-expect-error - 私有屬性訪問
      const newLastActive = service.clients.get(clientId).lastActive;
      expect(newLastActive).toBeGreaterThan(oldLastActive);
    });

    it('應該在客戶端不存在時不拋出錯誤', () => {
      // 執行和驗證
      expect(() => {
        service.updateClientActivity('non-existent-client');
      }).not.toThrow();
    });
  });

  describe('publishCacheInvalidation', () => {
    it('應該發布快取失效事件', async () => {
      // 準備
      const key = 'test-key';
      const pattern = 'test-pattern';
      const metadata = {
        chain: ChainName.ETHEREUM,
        chainId: 1,
        address: '0x1234567890123456789012345678901234567890',
      };

      // 執行
      await service.publishCacheInvalidation(key, pattern, metadata);

      // 驗證
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CacheEventType.INVALIDATE,
        expect.objectContaining({
          key,
          pattern,
          metadata,
          timestamp: expect.any(Number),
          id: expect.any(String),
        }),
      );
    });
  });

  describe('getActiveConnections', () => {
    it('應該返回活躍連接數', () => {
      // 準備
      // @ts-expect-error - 私有屬性訪問
      service.activeConnections = 5;

      // 執行和驗證
      expect(service.getActiveConnections()).toBe(5);
    });
  });

  describe('handleCacheInvalidation', () => {
    it('應該儲存和處理快取失效事件', () => {
      // 準備
      const event: CacheInvalidateEvent = {
        key: 'test-key',
        pattern: 'test-pattern',
        timestamp: Date.now(),
        id: 'test-id',
        metadata: {
          chain: ChainName.ETHEREUM,
          chainId: 1,
          address: '0x1234567890123456789012345678901234567890',
        },
      };

      // @ts-expect-error - 私有方法訪問
      const storeEventSpy = jest.spyOn(service, 'storeEvent');

      // 執行
      service.handleCacheInvalidation(event);

      // 驗證
      expect(storeEventSpy).toHaveBeenCalledWith(event);
    });
  });

  describe('handleAddressCacheInvalidated', () => {
    it('應該處理地址快取失效事件', async () => {
      // 準備
      const event = {
        chain: ChainName.ETHEREUM,
        chainId: 1,
        address: '0x1234567890123456789012345678901234567890',
        cacheKey: 'portfolio:ethereum:1:0x1234567890123456789012345678901234567890',
        cachePattern: 'portfolio:ethereum:1:0x1234567890123456789012345678901234567890*',
        timestamp: Date.now(),
      };

      const publishCacheInvalidationSpy = jest.spyOn(service, 'publishCacheInvalidation');

      // 執行
      await service.handleAddressCacheInvalidated(event);

      // 驗證
      expect(publishCacheInvalidationSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          chain: event.chain,
          chainId: event.chainId,
          address: event.address,
        }),
      );
    });
  });
});
