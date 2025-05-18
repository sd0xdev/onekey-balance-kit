import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Timeout } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WebhookManagementService } from './webhook-management.service';
import { PortfolioSnapshot } from '../core/db/schemas/portfolio-snapshot.schema';
import { ChainName, CHAIN_INFO_MAP } from '../chains/constants';
import { AppConfigService } from '../config/config.service';
import { AlchemyNetworkUtils } from './utils/alchemy-network.utils';
import { DEFAULT_MONITORED_ADDRESS } from './constants/webhook.constants';

/**
 * Webhook地址校正服務
 * 負責定期檢查webhook上的訂閱地址，確保刪除過期或不存在的地址
 */
@Injectable()
export class WebhookAddressReconciliationService {
  private readonly logger = new Logger(WebhookAddressReconciliationService.name);
  private readonly environment: string;
  private readonly webhookUrl: string;
  private existingWebhooks: any[] = [];

  constructor(
    private readonly webhookManagementService: WebhookManagementService,
    private readonly configService: AppConfigService,
    @InjectModel(PortfolioSnapshot.name) private portfolioModel: Model<PortfolioSnapshot>,
  ) {
    // 獲取當前環境
    this.environment = this.configService.app?.env || 'development';
    this.webhookUrl = this.configService.webhook?.url || '';
    this.logger.log(
      `Webhook地址校正服務初始化，當前環境：${this.environment}，Webhook URL：${this.webhookUrl}`,
    );
  }

  /**
   * 每日凌晨3點執行地址校正任務
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async reconcileWebhookAddresses() {
    this.logger.log('開始執行webhook地址校正任務');

    if (!this.webhookUrl) {
      this.logger.error('未配置Webhook URL，無法執行地址校正任務');
      return;
    }

    try {
      // 獲取當前所有已存在的webhooks
      this.existingWebhooks = (await this.webhookManagementService.getExistingWebhooks()) || [];
      if (this.existingWebhooks.length === 0) {
        this.logger.log('當前沒有已存在的webhook，跳過校正任務');
        return;
      }

      // 記錄所有webhook的基本信息，用於診斷
      for (const webhook of this.existingWebhooks) {
        this.logger.debug(
          `找到webhook: ID=${webhook.id}, URL=${webhook.webhook_url}, 網絡=${webhook.network}, 活躍=${webhook.is_active}`,
        );
      }

      // 從有效的webhook中獲取對應的鏈
      // 只處理屬於當前環境URL的webhook
      const activeWebhooks = this.existingWebhooks.filter(
        (webhook) => webhook.is_active && webhook.webhook_url === this.webhookUrl,
      );

      if (activeWebhooks.length === 0) {
        this.logger.log('沒有找到當前環境的active webhook，跳過校正任務');
        return;
      }

      this.logger.log(`找到 ${activeWebhooks.length} 個當前環境的active webhook`);

      // 遍歷所有活躍的webhook
      for (const webhook of activeWebhooks) {
        // 從webhook獲取對應的鏈名稱
        const chain = this.getChainNameFromNetworkId(webhook.network);
        if (!chain) {
          this.logger.warn(
            `無法識別webhook ID ${webhook.id} 的鏈名稱：${webhook.network}，跳過處理`,
          );
          continue;
        }

        await this.reconcileChainAddresses(chain, webhook.id, webhook);
      }
    } catch (error) {
      this.logger.error(`獲取已存在webhooks時出錯：${error}`);
    }

    this.logger.log('webhook地址校正任務完成');
  }

  /**
   * 將Alchemy網絡ID轉換為ChainName
   */
  private getChainNameFromNetworkId(networkId: string): ChainName | null {
    return AlchemyNetworkUtils.getChainNameFromNetworkId(networkId);
  }

  /**
   * 校正單個鏈上的地址
   * @param chain 區塊鏈名稱
   * @param webhookId webhook ID
   * @param webhook webhook 對象
   */
  private async reconcileChainAddresses(
    chain: ChainName,
    webhookId: string,
    webhook: any,
  ): Promise<void> {
    try {
      this.logger.debug(`開始校正 ${chain} 鏈上的地址 (Webhook ID: ${webhookId})`);

      // 使用Alchemy SDK獲取完整的webhook信息，包括地址列表
      const addresses = await this.webhookManagementService.getWebhookDetailsWithSdk(
        chain,
        webhookId,
      );
      if (!addresses || addresses.length === 0) {
        this.logger.warn(`無法獲取webhook ${webhookId} 的詳細信息，跳過校正`);
        return;
      }

      this.logger.debug(`${chain} 鏈上共有 ${addresses.length} 個訂閱地址`);

      // 檢查每個訂閱地址的狀態
      const addressesToRemove: string[] = [];
      const now = new Date();

      for (const address of addresses) {
        // 如果是預設監控地址，永遠不移除
        if (address.toLowerCase() === DEFAULT_MONITORED_ADDRESS.toLowerCase()) {
          this.logger.debug(`地址 ${address} 是預設監控地址，將被保留`);
          continue;
        }

        // 查詢地址在MongoDB中的最新有效快照
        const latestSnapshot = await this.portfolioModel
          .findOne({
            chain: chain,
            address: address,
            expiresAt: { $gt: now }, // 檢查是否未過期
          })
          .sort({ createdAt: -1 }) // 按創建時間降序排列，取最新的一筆
          .lean();

        // 如果記錄不存在或已過期，需要從webhook中移除
        if (!latestSnapshot) {
          addressesToRemove.push(address);
          this.logger.debug(`地址 ${address} 在 ${chain} 上已過期或不存在，將從webhook中移除`);
        } else {
          this.logger.debug(
            `地址 ${address} 在 ${chain} 上仍然有效，保留在webhook中，過期時間：${latestSnapshot.expiresAt}`,
          );
        }
      }

      // 從webhook中移除過期或不存在的地址
      if (addressesToRemove.length > 0) {
        this.logger.log(
          `從 ${chain} webhook中移除 ${addressesToRemove.length} 個過期或不存在的地址: ${addressesToRemove.slice(0, 5).join(', ')}${addressesToRemove.length > 5 ? '...' : ''}`,
        );

        const success = await this.webhookManagementService.updateWebhookAddresses(
          chain,
          [], // 不添加新地址
          addressesToRemove, // 要移除的地址
        );

        if (success) {
          this.logger.log(`成功從 ${chain} webhook中移除 ${addressesToRemove.length} 個地址`);

          // 更新數據庫中的標記
          const updateResult = await this.portfolioModel.updateMany(
            {
              chain: chain,
              address: { $in: addressesToRemove },
            },
            {
              $unset: { webhookMonitored: 1 },
            },
          );

          this.logger.debug(`數據庫標記更新結果: ${JSON.stringify(updateResult)}`);
        } else {
          this.logger.error(`無法從 ${chain} webhook中移除地址`);
        }
      } else {
        this.logger.debug(`${chain} 鏈上沒有需要移除的地址`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `校正 ${chain} 鏈上地址時發生錯誤: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * 手動觸發執行校正任務
   */
  @Timeout(5000) // 服務啟動後5秒執行
  async immediateReconciliation() {
    this.logger.log('立即執行 webhook 地址校正任務');
    await this.reconcileWebhookAddresses();
  }
}
