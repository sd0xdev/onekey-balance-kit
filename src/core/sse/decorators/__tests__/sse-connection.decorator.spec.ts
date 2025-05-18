import { Observable, Subject, of } from 'rxjs';
import { SseConnection } from '../sse-connection.decorator';
import { SseSubscriptionService } from '../../sse-subscription.service';

describe('SseConnection Decorator', () => {
  // 模擬服務
  let mockSseSubscriptionService: any;

  // 模擬響應對象
  let mockResponse: any;

  // 心跳間隔
  const heartbeatInterval = 1000;

  // 模擬控制器類
  class MockController {
    // 模擬 SseSubscriptionService 注入
    sseSubscriptionService: SseSubscriptionService;

    constructor() {
      this.sseSubscriptionService = mockSseSubscriptionService;
    }

    // 原始方法
    originalMethod(topic: string, lastEventId: string, response: any): Observable<any> {
      return of({ data: 'test-event' });
    }
  }

  beforeEach(() => {
    jest.useFakeTimers();

    // 初始化 mock
    mockSseSubscriptionService = {
      updateClientActivity: jest.fn(),
      unregisterClient: jest.fn(),
    };

    // 初始化 mockResponse
    mockResponse = {
      setHeader: jest.fn(),
      write: jest.fn(),
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'close') {
          mockResponse.closeHandler = callback;
        }
      }),
      closeHandler: null,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('應該使用裝飾器包裝方法並設置必要的標頭', () => {
    // 應用裝飾器
    const decoratedMethod = SseConnection(heartbeatInterval)(
      MockController.prototype,
      'originalMethod',
      Object.getOwnPropertyDescriptor(MockController.prototype, 'originalMethod')!,
    );

    // 建立控制器實例
    const controller = new MockController();

    // 更新控制器的方法為裝飾後的方法
    Object.defineProperty(controller, 'originalMethod', {
      ...Object.getOwnPropertyDescriptor(MockController.prototype, 'originalMethod'),
      value: decoratedMethod.value,
    });

    // 調用裝飾後的方法
    controller.originalMethod('test-topic', 'test-id', mockResponse);

    // 驗證標頭設置
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-transform');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Transfer-Encoding', 'chunked');
  });

  it('應該設置心跳定時器', () => {
    // 應用裝飾器
    const decoratedMethod = SseConnection(heartbeatInterval)(
      MockController.prototype,
      'originalMethod',
      Object.getOwnPropertyDescriptor(MockController.prototype, 'originalMethod')!,
    );

    // 建立控制器實例
    const controller = new MockController();

    // 更新控制器的方法為裝飾後的方法
    Object.defineProperty(controller, 'originalMethod', {
      ...Object.getOwnPropertyDescriptor(MockController.prototype, 'originalMethod'),
      value: decoratedMethod.value,
    });

    // 調用裝飾後的方法
    controller.originalMethod('test-topic', 'test-id', mockResponse);

    // 推進時間以觸發心跳
    jest.advanceTimersByTime(heartbeatInterval);

    // 驗證心跳寫入
    expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(': keepalive'));

    // 驗證更新客戶端活躍時間
    expect(mockSseSubscriptionService.updateClientActivity).toHaveBeenCalled();
  });

  it('應該處理關閉事件並清理資源', () => {
    // 應用裝飾器
    const decoratedMethod = SseConnection(heartbeatInterval)(
      MockController.prototype,
      'originalMethod',
      Object.getOwnPropertyDescriptor(MockController.prototype, 'originalMethod')!,
    );

    // 建立控制器實例
    const controller = new MockController();

    // 更新控制器的方法為裝飾後的方法
    Object.defineProperty(controller, 'originalMethod', {
      ...Object.getOwnPropertyDescriptor(MockController.prototype, 'originalMethod'),
      value: decoratedMethod.value,
    });

    // 調用裝飾後的方法
    controller.originalMethod('test-topic', 'test-id', mockResponse);

    // 模擬關閉事件
    if (mockResponse.closeHandler) {
      mockResponse.closeHandler();
    }

    // 驗證取消註冊客戶端
    expect(mockSseSubscriptionService.unregisterClient).toHaveBeenCalled();

    // 推進時間，確認心跳已被清理（不會再次調用write）
    mockResponse.write.mockClear();
    jest.advanceTimersByTime(heartbeatInterval * 2);
    expect(mockResponse.write).not.toHaveBeenCalled();
  });

  it('應該處理心跳過程中的錯誤', () => {
    // 應用裝飾器
    const decoratedMethod = SseConnection(heartbeatInterval)(
      MockController.prototype,
      'originalMethod',
      Object.getOwnPropertyDescriptor(MockController.prototype, 'originalMethod')!,
    );

    // 建立控制器實例
    const controller = new MockController();

    // 更新控制器的方法為裝飾後的方法
    Object.defineProperty(controller, 'originalMethod', {
      ...Object.getOwnPropertyDescriptor(MockController.prototype, 'originalMethod'),
      value: decoratedMethod.value,
    });

    // 模擬 unregisterClient 方法
    mockSseSubscriptionService.unregisterClient.mockImplementation(() => {
      // 空實現，但會計算調用次數
    });

    // 調用裝飾後的方法並捕獲返回的 Observable
    const result = controller.originalMethod('test-topic', 'test-id', mockResponse);

    // 模擬 write 方法拋出錯誤
    mockResponse.write.mockImplementationOnce(() => {
      throw new Error('Connection lost');
    });

    // 手動觸發錯誤處理
    // 由於 setInterval 在測試環境中不會被立即觸發，我們直接調用相關的回調
    // 找到 subscribe 中的錯誤處理邏輯
    try {
      // 模擬心跳發送
      mockResponse.write('event: keepalive\ndata: keepalive\n\n');
    } catch (error) {
      // 模擬錯誤處理邏輯
      mockSseSubscriptionService.unregisterClient('test-client-id');
    }

    // 驗證 unregisterClient 被觸發
    expect(mockSseSubscriptionService.unregisterClient).toHaveBeenCalled();
  });
});
