import { Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SseSubscriptionService } from '../sse-subscription.service';

interface MessageEvent {
  data: string;
  id?: string;
  type?: string;
  retry?: number;
}

/**
 * SSE 連接裝飾器，處理標頭設置和心跳機制
 * @param heartbeatIntervalMs 心跳間隔 (毫秒)
 */
export function SseConnection(heartbeatIntervalMs = 15000) {
  const logger = new Logger('SseConnection');

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      // 從參數中獲取 response 和 SseSubscriptionService
      const response: Response = args.find((arg) => arg instanceof Object && 'setHeader' in arg);
      const sseService: SseSubscriptionService = this.sseSubscriptionService;

      if (!response || !sseService) {
        logger.error('無法獲取 Response 或 SseSubscriptionService 實例');
        return originalMethod.apply(this, args);
      }

      // 生成唯一的客戶端 ID
      const clientId = uuidv4();

      // 正確提取主題和 lastEventId
      // 1. 檢查是否有 params 對象（NestJS 的參數裝飾器會添加）
      const paramObj = args.find(
        (arg) => arg && typeof arg === 'object' && 'params' in arg && arg.params?.topic,
      );

      // 2. 檢查是否有 headers 對象（用於 lastEventId）
      const headerObj = args.find((arg) => arg && typeof arg === 'object' && 'headers' in arg);

      let topic = paramObj?.params?.topic;
      let lastEventId = headerObj?.headers?.['last-event-id'];

      // 如果上面的方法沒有找到，嘗試直接從位置參數中獲取
      if (!topic && args.length > 0 && typeof args[0] === 'string') {
        topic = args[0];
      }

      if (!lastEventId && args.length > 1 && typeof args[1] === 'string') {
        lastEventId = args[1];
      }

      logger.debug(
        `SSE裝飾器分析參數: topic=${topic || '未定義'}, lastEventId=${lastEventId || '無'}, clientId=${clientId}`,
      );

      // 創建一個 Subject，當連接關閉時發出訊號
      const close$ = new Subject<void>();

      // 設置 HTTP 標頭，優化 SSE 連接
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache, no-transform');
      response.setHeader('Connection', 'keep-alive');
      response.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 緩衝
      response.setHeader('Transfer-Encoding', 'chunked'); // 防止代理服務器的超時

      // 設置自動心跳
      const keepAliveInterval = setInterval(() => {
        try {
          // 更新客戶端活躍時間
          sseService.updateClientActivity(clientId);

          // 發送 SSE 註釋行作為保持連接
          response.write(`: keepalive ${Date.now()}\n\n`);
          logger.debug(`已向客戶端 ${clientId} 發送心跳並更新活躍時間`);
        } catch (error) {
          logger.error(`發送心跳到客戶端 ${clientId} 時出錯: ${error.message}`);
          // 如果發送心跳出錯，可能是連接已關閉，清理資源
          clearInterval(keepAliveInterval);
          close$.next();
          close$.complete();
        }
      }, heartbeatIntervalMs);

      // 當連接關閉時清理
      response.on('close', () => {
        logger.debug(`客戶端 ${clientId} 的 SSE 連接已關閉，正在清理資源`);
        clearInterval(keepAliveInterval);
        sseService.unregisterClient(clientId);
        close$.next();
        close$.complete();
      });

      // 使用原始方法獲取 Observable，但傳入 clientId
      // 將 clientId 添加到參數中
      const newArgs = [...args, clientId, close$];
      const result = originalMethod.apply(this, newArgs) as Observable<MessageEvent>;
      return result;
    };

    return descriptor;
  };
}
