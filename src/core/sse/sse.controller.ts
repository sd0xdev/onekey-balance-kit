import { Controller, Get, Headers, Logger, Param, Res, Sse } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Observable, Subject, interval, map, merge, takeUntil, tap } from 'rxjs';
import { Throttle } from '@nestjs/throttler';
import { SseSubscriptionService } from './sse-subscription.service';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';

interface MessageEvent {
  data: string;
  id?: string;
  type?: string;
  retry?: number;
}

@ApiTags('快取事件')
@Controller('sse')
export class SseController {
  private readonly logger = new Logger(SseController.name);

  constructor(private readonly sseSubscriptionService: SseSubscriptionService) {}

  @ApiOperation({
    summary: '訂閱快取失效事件',
    description:
      '建立一個 SSE 連接來接收所有快取失效通知，前端可根據事件數據自行判斷是否關心該地址。支援 Last-Event-ID 自動重播丟失的事件，內建自動心跳機制',
  })
  @ApiProduces('text/event-stream')
  @ApiParam({
    name: 'topic',
    description: '要訂閱的主題 (如: "cache")',
    example: 'cache',
  })
  @Sse('subscribe/:topic')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  subscribeToEvents(
    @Param('topic') topic: string,
    @Headers('last-event-id') lastEventId: string,
    @Res() response: Response,
    clientId?: string,
    close$?: Subject<void>,
  ): Observable<MessageEvent> {
    const effectiveClientId = clientId || uuidv4();
    const effectiveClose$ = close$ || new Subject<void>();

    this.logger.debug(
      `控制器接收到參數: topic=${topic}, lastEventId=${lastEventId || '無'}, clientId=${effectiveClientId}`,
    );

    response.on('close', () => {
      this.logger.debug(`客戶端 ${effectiveClientId} 的連接已關閉，停止心跳和清理資源`);
      this.sseSubscriptionService.unregisterClient(effectiveClientId);
      effectiveClose$.next();
      effectiveClose$.complete();
    });

    const eventStream = this.sseSubscriptionService.getEventStream(effectiveClientId, lastEventId);

    const heartbeat$ = interval(10000).pipe(
      takeUntil(effectiveClose$),
      tap(() => {
        this.sseSubscriptionService.updateClientActivity(effectiveClientId);
        this.logger.debug(`發送心跳到客戶端 ${effectiveClientId} 並更新活躍時間`);
      }),
      map(() => ({
        data: `: keepalive ${Date.now()}`,
      })),
    );

    return merge(eventStream, heartbeat$).pipe(takeUntil(effectiveClose$));
  }

  @Get('stats')
  getStats() {
    return {
      activeConnections: this.sseSubscriptionService.getActiveConnections(),
      timestamp: Date.now(),
    };
  }
}
