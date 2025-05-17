import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DbService } from '../db/db.service';
import {
  NotificationEventType,
  PortfolioRedisUpdatedEvent,
} from '../../notification/notification.service';

/**
 * 投資組合MongoDB同步監聽器
 * 負責監聽Redis更新事件並同步到MongoDB
 */
@Injectable()
export class PortfolioMongoListener {
  private readonly logger = new Logger(PortfolioMongoListener.name);

  constructor(private readonly dbService: DbService) {}

  /**
   * 將 BalanceResponse 格式轉換為 MongoDB 模型格式
   */
  private transformPortfolioData(data: any): any {
    // 如果數據已經是正確格式，則直接返回
    if (data.native && !data.nativeBalance) {
      return data;
    }

    const transformed = { ...data };

    // 如果存在 nativeBalance 字段但沒有 native 字段，進行轉換
    if (data.nativeBalance && !data.native) {
      transformed.native = { ...data.nativeBalance };
      delete transformed.nativeBalance;
    }

    // 確保 blockNumber 字段存在
    if (!transformed.blockNumber) {
      transformed.blockNumber = 0;
    }

    // 如果有 tokens 字段但沒有 fungibles 字段，進行轉換
    if (data.tokens && !data.fungibles) {
      transformed.fungibles = data.tokens;
      delete transformed.tokens;
    }

    return transformed;
  }

  /**
   * 處理Redis投資組合更新事件
   * 將數據同步到MongoDB，使用MongoDB特有的TTL設置
   */
  @OnEvent(NotificationEventType.PORTFOLIO_REDIS_UPDATED)
  async handlePortfolioRedisUpdated(event: PortfolioRedisUpdatedEvent): Promise<void> {
    try {
      this.logger.debug(
        `Syncing portfolio data to MongoDB: ${event.chain}:${event.chainId}:${event.address}`,
      );

      // 轉換數據格式以符合 MongoDB 模型
      const transformedData = this.transformPortfolioData(event.portfolioData);

      // 直接使用DbService將數據保存到MongoDB，使用MongoDB特有的TTL
      await this.dbService.savePortfolioSnapshot(
        event.chain,
        event.chainId,
        event.address,
        transformedData,
        event.provider,
        event.mongoTtlSeconds, // 使用MongoDB特有的TTL設置
      );

      this.logger.debug(
        `Successfully synced portfolio data to MongoDB for ${event.chain}:${event.chainId}:${event.address} with TTL: ${event.mongoTtlSeconds || 'default'} seconds`,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to sync portfolio data to MongoDB: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
