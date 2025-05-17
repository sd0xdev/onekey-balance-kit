import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WebhookEventDto,
  WebhookEventType,
  AddressActivityEvent,
  NftActivityEvent,
  MinedTransactionEvent,
  GraphqlEvent,
} from './dto/webhook-event.dto';
import { WebhookEvent } from '../core/db/schemas/webhook-event.schema';
import { ChainName, NETWORK_ID_TO_CHAIN_MAP, getChainIdFromNetworkId } from '../chains/constants';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
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
          await this.handleNftActivity(payload);
          break;
        case WebhookEventType.MINED_TRANSACTION:
          await this.handleMinedTransaction(payload);
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

  /**
   * 處理地址活動事件
   * 使該地址的所有緩存失效並重新獲取最新數據
   */
  private async handleAddressActivity(payload: WebhookEventDto): Promise<void> {
    try {
      const event = payload.event as AddressActivityEvent;
      const network = event.network;

      // 從網絡標識符映射到鏈類型和ID
      const chain = this.mapNetworkToChainType(network);
      if (!chain) {
        this.logger.warn(`Cannot handle event for unknown network: ${network}`);
        return;
      }

      const chainId = getChainIdFromNetworkId(network);
      if (!chainId) {
        this.logger.warn(`Cannot determine chain ID for network: ${network}`);
        return;
      }

      // 處理事件中的所有活動
      if (event.activity && event.activity.length > 0) {
        for (const activity of event.activity) {
          // 失效 fromAddress 和 toAddress 的緩存
          const addresses = [activity.fromAddress, activity.toAddress].filter(Boolean);

          for (const address of addresses) {
            try {
              this.logger.debug(`Processing address activity for: ${address} on chain: ${chain}`);

              // 發送通知，緩存失效由通知消費者處理
              this.notificationService.emitAddressActivity(chain, chainId, address, {
                txHash: activity.hash,
                eventType: payload.type,
              });
            } catch (innerError) {
              this.logger.error(
                `Failed to process activity for address ${address}: ${String(innerError)}`,
              );
              // 繼續處理其他地址，不拋出錯誤
            }
          }
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle address activity: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 處理NFT活動事件
   * 更新NFT擁有權和元數據
   */
  private async handleNftActivity(payload: WebhookEventDto): Promise<void> {
    try {
      const event = payload.event as NftActivityEvent;
      const network = event.network;
      const chain = this.mapNetworkToChainType(network);

      if (!chain) {
        this.logger.warn(`Cannot handle NFT event for unknown network: ${network}`);
        return;
      }

      const chainId = getChainIdFromNetworkId(network);
      if (!chainId) {
        this.logger.warn(`Cannot determine chain ID for network: ${network}`);
        return;
      }

      // 處理事件中的所有NFT活動
      if (event.activity && event.activity.length > 0) {
        for (const activity of event.activity) {
          // 獲取tokenId (erc721TokenId或erc1155TokenId)
          const tokenId = activity.erc721TokenId || activity.erc1155TokenId || '0';

          // 發出NFT活動通知
          this.notificationService.emitNftActivity(
            chain,
            activity.contractAddress,
            tokenId,
            activity.fromAddress,
            activity.toAddress,
          );

          // 為相關地址發送活動通知，緩存失效將由通知消費者處理
          if (activity.fromAddress) {
            this.notificationService.emitAddressActivity(chain, chainId, activity.fromAddress, {
              action: 'nft_transfer',
              contractAddress: activity.contractAddress,
              tokenId,
            });
          }

          if (activity.toAddress) {
            this.notificationService.emitAddressActivity(chain, chainId, activity.toAddress, {
              action: 'nft_transfer',
              contractAddress: activity.contractAddress,
              tokenId,
            });
          }
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle NFT activity: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 處理已挖出交易事件
   */
  private async handleMinedTransaction(payload: WebhookEventDto): Promise<void> {
    try {
      const event = payload.event as MinedTransactionEvent;
      const network = event.network;
      const chain = this.mapNetworkToChainType(network);

      if (!chain) {
        this.logger.warn(`Cannot handle transaction event for unknown network: ${network}`);
        return;
      }

      const chainId = getChainIdFromNetworkId(network);
      if (!chainId) {
        this.logger.warn(`Cannot determine chain ID for network: ${network}`);
        return;
      }

      // 發送交易通知
      this.notificationService.emitTransactionMined(chain, event.hash, event.from, event.to);

      // 為相關地址發送活動通知，緩存失效將由通知消費者處理
      if (event.from) {
        this.notificationService.emitAddressActivity(chain, chainId, event.from, {
          action: 'transaction_mined',
          txHash: event.hash,
        });
      }

      if (event.to) {
        this.notificationService.emitAddressActivity(chain, chainId, event.to, {
          action: 'transaction_mined',
          txHash: event.hash,
        });
      }
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
