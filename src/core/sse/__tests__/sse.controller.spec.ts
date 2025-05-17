import { Test, TestingModule } from '@nestjs/testing';
import { Observable, Subject, of } from 'rxjs';
import { SseController } from '../sse.controller';
import { SseSubscriptionService } from '../sse-subscription.service';

describe('SseController', () => {
  let controller: SseController;
  let sseService: SseSubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SseController],
      providers: [
        {
          provide: SseSubscriptionService,
          useValue: {
            getEventStream: jest.fn(),
            updateClientActivity: jest.fn(),
            unregisterClient: jest.fn(),
            getActiveConnections: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SseController>(SseController);
    sseService = module.get<SseSubscriptionService>(SseSubscriptionService);

    // 模擬 logger
    jest.spyOn(controller['logger'], 'debug').mockImplementation(() => {});
    jest.spyOn(controller['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(controller['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('應該被定義', () => {
    expect(controller).toBeDefined();
  });

  describe('subscribeToEvents', () => {
    it('應該使用 SseSubscriptionService 獲取事件流', () => {
      // 準備
      const topic = 'cache';
      const lastEventId = 'last-event-id';
      const clientId = 'test-client-id';
      const close$ = new Subject<void>();

      const mockResponse = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            // 儲存關閉回調，稍後可以調用它進行測試
            mockResponse.closeCallback = callback;
          }
          return mockResponse;
        }),
        closeCallback: null as (() => void) | null,
        setHeader: jest.fn(),
      };

      // 模擬 getEventStream 返回一個 Observable
      const mockEventStream = of({ data: 'test-event' });
      jest.spyOn(sseService, 'getEventStream').mockReturnValue(mockEventStream);

      // 執行
      const result = controller.subscribeToEvents(
        topic,
        lastEventId,
        mockResponse as any,
        clientId,
        close$,
      );

      // 驗證
      expect(sseService.getEventStream).toHaveBeenCalledWith(clientId, lastEventId);
      expect(result).toBeDefined();
      expect(result instanceof Observable).toBe(true);

      // 測試關閉事件處理
      if (mockResponse.closeCallback) {
        mockResponse.closeCallback();
        expect(sseService.unregisterClient).toHaveBeenCalledWith(clientId);
      }
    });
  });

  describe('getStats', () => {
    it('應該返回活躍連接統計資訊', () => {
      // 準備
      const activeConnections = 42;
      jest.spyOn(sseService, 'getActiveConnections').mockReturnValue(activeConnections);

      // 執行
      const result = controller.getStats();

      // 驗證
      expect(result.activeConnections).toBe(activeConnections);
      expect(result.timestamp).toBeDefined();
    });
  });
});
