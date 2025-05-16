import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CacheService } from '../core/cache/cache.service';
import { CacheKeyService } from '../core/cache/cache-key.service';
import {
  WebhookEventDto,
  WebhookEventType,
  AddressActivityEvent,
  NftActivityEvent,
  MinedTransactionEvent,
  GraphqlEvent,
} from './dto/webhook-event.dto';
import { WebhookEvent } from '../core/db/schemas/webhook-event.schema';
import {
  ChainName,
  NETWORK_ID_TO_CHAIN_MAP,
  getChainId,
  getChainIdFromNetworkId,
} from '../chains/constants';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheKeyService: CacheKeyService,
    private readonly notificationService: NotificationService,
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
          this.handleNftActivity(payload);
          break;
        case WebhookEventType.MINED_TRANSACTION:
          this.handleMinedTransaction(payload);
          break;
        case WebhookEventType.DROPPED_TRANSACTION:
          this.handleDroppedTransaction(payload);
          break;
        case WebhookEventType.GRAPHQL:
          this.handleGraphqlEvent(payload);
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
      const event = payload.event as AddressActivityEvent;

      // 處理每個活動項目
      for (const activity of event.activity) {
        const address = activity.fromAddress; // 或 toAddress，根據需求處理
        const network = event.network;
        const chainType = this.mapNetworkToChainType(network);
        const chainId = getChainIdFromNetworkId(network);

        if (!address || !chainType) {
          this.logger.warn(
            `Invalid address activity, missing address or chain type: ${JSON.stringify(activity)}`,
          );
          continue;
        }

        this.logger.debug(`Handling address activity for ${chainType}:${address}`);

        // 使用 NotificationService 發送事件，而不是直接調用緩存服務
        if (chainId) {
          this.notificationService.emitAddressActivity(chainType, chainId, address, {
            activity,
            network,
          });
        } else {
          this.logger.warn(`No chain ID for network ${network}, using fallback method`);
          // 如果沒有鏈ID，使用基於鏈類型和地址的模式匹配
          const deletedCount = await this.cacheKeyService.invalidateAddressCache(
            chainType,
            address,
          );
          this.logger.debug(
            `Invalidated ${deletedCount} cache entries for ${chainType}:${address}`,
          );
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to handle address activity: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private handleNftActivity(payload: WebhookEventDto): void {
    try {
      const event = payload.event as NftActivityEvent;
      this.logger.debug(`Handling NFT activity for network: ${event.network}`);

      // 處理每個 NFT 活動項目
      for (const activity of event.activity) {
        const chainType = this.mapNetworkToChainType(event.network);
        if (!chainType) {
          this.logger.warn(`Unknown network type: ${event.network}`);
          continue;
        }

        // 使用 NotificationService 發送 NFT 活動事件
        this.notificationService.emitNftActivity(
          chainType,
          activity.contractAddress,
          activity.erc721TokenId || activity.erc1155TokenId || '0',
          activity.fromAddress,
          activity.toAddress,
        );
      }

      this.logger.debug(`Processed ${event.activity.length} NFT activity items`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle NFT activity: ${errorMessage}`);
      throw error;
    }
  }

  private handleMinedTransaction(payload: WebhookEventDto): void {
    try {
      const event = payload.event as MinedTransactionEvent;
      this.logger.debug(`Transaction mined: ${event.hash} on ${event.network}`);

      const chainType = this.mapNetworkToChainType(event.network);
      if (!chainType) {
        this.logger.warn(`Unknown network type: ${event.network}`);
        return;
      }

      // 使用 NotificationService 發送交易確認事件
      this.notificationService.emitTransactionMined(chainType, event.hash, event.from, event.to);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle mined transaction: ${errorMessage}`);
      throw error;
    }
  }

  private handleDroppedTransaction(payload: WebhookEventDto): void {
    try {
      const event = payload.event as MinedTransactionEvent;
      this.logger.debug(`Transaction dropped: ${event.hash} on ${event.network}`);

      // 這裡可以添加類似 MinedTransaction 的處理，或者新增 TransactionDropped 事件類型
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle dropped transaction: ${errorMessage}`);
      throw error;
    }
  }

  private handleGraphqlEvent(payload: WebhookEventDto): void {
    try {
      const event = payload.event as GraphqlEvent;
      this.logger.debug(`Received GraphQL custom webhook event: ${payload.id}`);

      // 使用 NotificationService 發送自定義事件
      this.notificationService.emitCustomEvent({
        webhookId: payload.webhookId,
        eventId: payload.id,
        data: event.data,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle GraphQL event: ${errorMessage}`);
      throw error;
    }
  }

  private mapNetworkToChainType(network: string): ChainName | null {
    const chainName = NETWORK_ID_TO_CHAIN_MAP[network];
    if (!chainName) {
      this.logger.warn(`Unknown network type: ${network}`);
      return null;
    }
    return chainName;
  }
}
