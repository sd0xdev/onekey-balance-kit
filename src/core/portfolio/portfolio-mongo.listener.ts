import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DbService } from '../db/db.service';
import {
  NotificationEventType,
  PortfolioRedisUpdatedEvent,
} from '../../notification/notification.service';
import { PortfolioSnapshot } from '../db/schemas/portfolio-snapshot.schema';
import { WebhookManagementService } from '../../webhook/webhook-management.service';
import { ChainName } from '../../chains/constants';

/**
 * 投資組合MongoDB同步監聽器
 * 負責監聽Redis更新事件並同步到MongoDB，並更新 webhook 監控地址
 */
@Injectable()
export class PortfolioMongoListener {
  private readonly logger = new Logger(PortfolioMongoListener.name);
  // 緩存已處理過的地址和鏈，防止頻繁更新
  private readonly processedAddresses: Map<string, number> = new Map();
  // 處理間隔時間（毫秒）
  private readonly processInterval: number = 5 * 60 * 1000; // 5分鐘

  constructor(
    private readonly dbService: DbService,
    private readonly webhookManagementService: WebhookManagementService,
    @InjectModel(PortfolioSnapshot.name) private portfolioModel: Model<PortfolioSnapshot>,
  ) {}

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
   * 將數據同步到MongoDB，使用MongoDB特有的TTL設置，並更新 webhook 監控地址
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

      // 更新該鏈的 webhook 監控地址
      await this.updateWebhookAddresses(event.chain, event.address);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to sync portfolio data to MongoDB: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * 更新 webhook 監控地址
   * @param chain 區塊鏈名稱
   * @param address 可選的特定地址，如果提供則只更新此地址
   */
  private async updateWebhookAddresses(chain: ChainName, address?: string): Promise<void> {
    try {
      // 生成處理鍵，如果提供了地址則使用地址+鏈的組合
      const processKey = address ? `${chain}:${address}` : chain;

      // 檢查該鏈或地址是否最近已處理過，避免頻繁更新
      const lastProcessTime = this.processedAddresses.get(processKey);
      const now = Date.now();

      if (lastProcessTime && now - lastProcessTime < this.processInterval) {
        this.logger.debug(
          `${address ? `Address ${address} on chain ${chain}` : `Chain ${chain}`} webhook was recently updated (${Math.round(
            (now - lastProcessTime) / 1000,
          )}s ago). Skipping.`,
        );
        return;
      }

      // 更新處理時間戳
      this.processedAddresses.set(processKey, now);

      // 若提供了特定地址，則只處理該地址
      if (address) {
        // 檢查地址是否需要加入或移除監控
        const isActive = await this.isAddressActive(chain, address);
        const isMonitored = await this.isAddressMonitored(chain, address);

        let addAddresses: string[] = [];
        let removeAddresses: string[] = [];

        if (isActive && !isMonitored) {
          // 活躍但未監控，需要添加
          addAddresses = [address];
        } else if (!isActive && isMonitored) {
          // 已過期但仍在監控，需要移除
          removeAddresses = [address];
        } else {
          // 無需更新
          this.logger.debug(`No changes needed for address ${address} on chain ${chain}`);
          return;
        }

        // 更新 webhook 監控地址
        const success = await this.webhookManagementService.updateWebhookAddresses(
          chain,
          addAddresses,
          removeAddresses,
        );

        if (success) {
          this.logger.debug(
            `Successfully updated webhook for address ${address} on chain ${chain}. ` +
              `${addAddresses.length > 0 ? 'Added to monitoring.' : ''}` +
              `${removeAddresses.length > 0 ? 'Removed from monitoring.' : ''}`,
          );

          // 更新數據庫標記
          if (addAddresses.length > 0) {
            await this.markAddressesAsMonitored(chain, addAddresses);
          } else if (removeAddresses.length > 0) {
            await this.unmarkExpiredAddresses(chain, removeAddresses);
          }
        } else {
          this.logger.error(`Failed to update webhook for address ${address} on chain ${chain}`);
        }

        return;
      }

      // 以下是處理整條鏈的邏輯

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

  private async isAddressActive(chain: string, address: string): Promise<boolean> {
    const now = new Date();
    const activeSnapshots = await this.portfolioModel
      .find({
        chain: chain,
        address: address,
        expiresAt: { $gt: now },
      })
      .lean();
    return activeSnapshots.length > 0;
  }

  private async isAddressMonitored(chain: string, address: string): Promise<boolean> {
    const activeSnapshots = await this.portfolioModel
      .find({
        chain: chain,
        address: address,
        webhookMonitored: true,
      })
      .lean();
    return activeSnapshots.length > 0;
  }
}
