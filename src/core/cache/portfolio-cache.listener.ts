import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService } from './cache.service';
import { CacheKeyService } from './cache-key.service';
import {
  NotificationEventType,
  PortfolioUpdateEvent,
  NotificationService,
} from '../../notification/notification.service';

/**
 * 投資組合Redis緩存監聽器
 * 負責監聽投資組合更新事件並同步到Redis緩存
 */
@Injectable()
export class PortfolioCacheListener {
  private readonly logger = new Logger(PortfolioCacheListener.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheKeyService: CacheKeyService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * 處理投資組合更新事件
   * 將數據同步到Redis緩存，然後發出 MongoDB 同步事件
   */
  @OnEvent(NotificationEventType.PORTFOLIO_UPDATE)
  async handlePortfolioUpdate(event: PortfolioUpdateEvent): Promise<void> {
    try {
      this.logger.debug(
        `Syncing portfolio data to Redis cache: ${event.chain}:${event.chainId}:${event.address}`,
      );

      // 1. 生成緩存鍵
      const cacheKey = this.cacheKeyService.createPortfolioKey(
        event.chain,
        event.address,
        event.provider,
      );

      // 2. 寫入Redis緩存
      await this.cacheService.set(cacheKey, event.portfolioData, event.ttlSeconds);

      this.logger.debug(
        `Successfully synced portfolio data to Redis for ${event.chain}:${event.address}`,
      );

      // 3. Redis 寫入成功後，發出 MongoDB 同步事件（使用不同的 TTL）
      // MongoDB 的 TTL 設為 30 分鐘
      const mongoTtlSeconds = 30 * 60; // 30 分鐘

      this.notificationService.emitPortfolioRedisUpdated(
        event.chain,
        event.chainId,
        event.address,
        event.portfolioData,
        event.provider,
        mongoTtlSeconds,
      );

      this.logger.debug(`Emitted MongoDB sync event for ${event.chain}:${event.address}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to sync portfolio data to Redis: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
