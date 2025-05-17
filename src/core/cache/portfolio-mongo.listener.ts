import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { Model } from 'mongoose';
import { WebhookManagementService } from '../../webhook/webhook-management.service';
import {
  NotificationEventType,
  PortfolioRedisUpdatedEvent,
} from '../../notification/notification.service';
import { PortfolioSnapshot } from '../db/schemas/portfolio-snapshot.schema';

/**
 * 投資組合 MongoDB 緩存監聽器
 * 負責監聽 Redis 投資組合更新事件，並更新 webhook 監控地址
 */
@Injectable()
export class PortfolioMongoListener {
  private readonly logger = new Logger(PortfolioMongoListener.name);
  // 緩存已處理過的鏈，防止頻繁查詢
  private readonly processedChains: Map<string, number> = new Map();
  // 處理間隔時間（毫秒）
  private readonly processInterval: number = 5 * 60 * 1000; // 5分鐘

  constructor(
    private readonly webhookManagementService: WebhookManagementService,
    @InjectModel(PortfolioSnapshot.name) private portfolioModel: Model<PortfolioSnapshot>,
  ) {}

  /**
   * 處理 Redis 投資組合更新事件，更新 webhook 監控地址
   * 直接監聽 PORTFOLIO_REDIS_UPDATED 事件，減少一次事件傳遞
   */
  @OnEvent(NotificationEventType.PORTFOLIO_REDIS_UPDATED)
  async handlePortfolioRedisUpdate(event: PortfolioRedisUpdatedEvent): Promise<void> {
    try {
      const chain = event.chain;
      const chainId = event.chainId;

      this.logger.debug(`Portfolio data updated in Redis: ${chain}:${chainId}:${event.address}`);

      // 檢查該鏈是否最近已處理過，避免頻繁更新
      const lastProcessTime = this.processedChains.get(chain);
      const now = Date.now();

      if (lastProcessTime && now - lastProcessTime < this.processInterval) {
        this.logger.debug(
          `Chain ${chain} was recently processed (${Math.round((now - lastProcessTime) / 1000)}s ago). Skipping.`,
        );
        return;
      }

      // 更新處理時間戳
      this.processedChains.set(chain, now);

      // 1. 查詢該鏈所有未過期的地址（用於添加到 webhook）
      const activeAddresses = await this.getActiveAddresses(chain);

      // 2. 查詢已過期的地址（用於從 webhook 中移除）
      const expiredAddresses = await this.getExpiredAddresses(chain);

      if (activeAddresses.length === 0 && expiredAddresses.length === 0) {
        this.logger.debug(`No addresses to update for webhook on chain ${chain}`);
        return;
      }

      // 3. 更新 webhook 監控地址
      const success = await this.webhookManagementService.updateWebhookAddresses(
        chain,
        activeAddresses, // 要添加的地址
        expiredAddresses, // 要移除的地址
      );

      if (success) {
        this.logger.debug(
          `Successfully updated webhook addresses for chain ${chain}. ` +
            `Added: ${activeAddresses.length}, Removed: ${expiredAddresses.length}`,
        );

        // 4. 標記已添加到 webhook 的地址
        if (activeAddresses.length > 0) {
          await this.markAddressesAsMonitored(chain, activeAddresses);
        }

        // 5. 移除已過期地址的標記
        if (expiredAddresses.length > 0) {
          await this.unmarkExpiredAddresses(chain, expiredAddresses);
        }
      } else {
        this.logger.error(`Failed to update webhook addresses for chain ${chain}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to update webhook monitoring: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * 獲取該鏈上所有未過期且未被標記為監控的活躍地址
   * @param chain 區塊鏈名稱
   * @returns 地址列表
   */
  private async getActiveAddresses(chain: string): Promise<string[]> {
    try {
      const now = new Date();

      // 查詢未過期且未被標記為已監控的地址
      const activeSnapshots = await this.portfolioModel
        .find({
          chain: chain,
          expiresAt: { $gt: now }, // 未過期
          webhookMonitored: { $ne: true }, // 未被標記為已監控
        })
        .select('address')
        .lean();

      return activeSnapshots.map((snapshot) => snapshot.address);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get active addresses: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 獲取該鏈上所有已過期但仍被標記為監控的地址
   * @param chain 區塊鏈名稱
   * @returns 地址列表
   */
  private async getExpiredAddresses(chain: string): Promise<string[]> {
    try {
      const now = new Date();

      // 查詢已過期但仍被標記為已監控的地址
      const expiredSnapshots = await this.portfolioModel
        .find({
          chain: chain,
          expiresAt: { $lte: now }, // 已過期
          webhookMonitored: true, // 被標記為已監控
        })
        .select('address')
        .lean();

      return expiredSnapshots.map((snapshot) => snapshot.address);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get expired addresses: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 標記地址為已監控
   * @param chain 區塊鏈名稱
   * @param addresses 地址列表
   */
  private async markAddressesAsMonitored(chain: string, addresses: string[]): Promise<void> {
    try {
      // 批量更新：標記為已監控
      await this.portfolioModel.updateMany(
        {
          chain: chain,
          address: { $in: addresses },
        },
        {
          $set: { webhookMonitored: true },
        },
      );

      this.logger.debug(`Marked ${addresses.length} addresses as monitored on chain ${chain}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to mark addresses as monitored: ${errorMessage}`);
    }
  }

  /**
   * 移除已過期地址的監控標記
   * @param chain 區塊鏈名稱
   * @param addresses 地址列表
   */
  private async unmarkExpiredAddresses(chain: string, addresses: string[]): Promise<void> {
    try {
      // 批量更新：移除監控標記
      await this.portfolioModel.updateMany(
        {
          chain: chain,
          address: { $in: addresses },
        },
        {
          $unset: { webhookMonitored: 1 },
        },
      );

      this.logger.debug(
        `Removed monitoring mark from ${addresses.length} addresses on chain ${chain}`,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to unmark expired addresses: ${errorMessage}`);
    }
  }
}
