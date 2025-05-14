import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CacheService } from '../core/cache/cache.service';
import { WebhookEventDto, WebhookEventType } from './dto/webhook-event.dto';
import { WebhookEvent } from '../core/db/schemas/webhook-event.schema';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly cacheService: CacheService,
    @InjectModel(WebhookEvent.name) private webhookEventModel: Model<WebhookEvent>,
  ) {}

  async processWebhookEvent(payload: WebhookEventDto): Promise<boolean> {
    this.logger.debug(`Processing webhook event: ${String(payload.type)}`);
    try {
      // 1. 記錄webhook事件到MongoDB
      await this.saveWebhookToDatabase(payload);

      // 2. 根據事件類型處理
      switch (payload.type) {
        case WebhookEventType.ADDRESS_ACTIVITY:
          await this.handleAddressActivity(payload);
          break;
        case WebhookEventType.TOKEN_ACTIVITY:
          this.logger.debug('Token activity event received - handling not yet implemented');
          break;
        case WebhookEventType.NFT_ACTIVITY:
          this.logger.debug('NFT activity event received - handling not yet implemented');
          break;
        default:
          this.logger.warn(`Unknown webhook event type: ${String(payload.type)}`);
      }

      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to process webhook event: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private async saveWebhookToDatabase(payload: WebhookEventDto): Promise<void> {
    try {
      await this.webhookEventModel.create({
        ...payload,
        receivedAt: new Date(),
      });
      this.logger.debug(`Webhook event saved to database: ${payload.id}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`Failed to save webhook event to database: ${errorMessage}`);
      // 重新拋出錯誤以便上層函數處理
      throw error;
    }
  }

  private async handleAddressActivity(payload: WebhookEventDto): Promise<void> {
    try {
      // 獲取相關地址
      const address = payload.data.address;
      const network = payload.data.network;
      const chainType = this.mapNetworkToChainType(network);

      if (!address || !chainType) {
        this.logger.warn(
          `Invalid webhook payload, missing address or chain type: ${JSON.stringify(payload.data)}`,
        );
        return;
      }

      this.logger.debug(`Handling address activity for ${chainType}:${address}`);

      // 從緩存中刪除相關數據
      const cacheKey = `portfolio:${chainType}:${address}`;
      await this.cacheService.delete(cacheKey);
      this.logger.debug(`Cache invalidated for ${cacheKey}`);

      // 在這裡可以實現推送通知、WebSocket廣播等功能
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to handle address activity: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private mapNetworkToChainType(network: string): 'eth' | 'sol' | null {
    // 根據 Alchemy 網絡標識符映射到我們的鏈類型
    switch (network) {
      case 'ETH_MAINNET':
        return 'eth';
      case 'SOL_MAINNET':
        return 'sol';
      default:
        this.logger.warn(`Unknown network type: ${network}`);
        return null;
    }
  }
}
