import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CacheKeyService } from '../core/cache/cache-key.service';
import { ChainName } from '../chains/constants';
import { ProviderType } from '../providers/constants/blockchain-types';

// 事件類型枚舉
export enum NotificationEventType {
  ADDRESS_ACTIVITY = 'address.activity',
  TOKEN_ACTIVITY = 'token.activity',
  NFT_ACTIVITY = 'nft.activity',
  TRANSACTION_MINED = 'transaction.mined',
  TRANSACTION_DROPPED = 'transaction.dropped',
  CUSTOM_EVENT = 'custom.event',
  PORTFOLIO_UPDATE = 'portfolio.update',
  PORTFOLIO_REDIS_UPDATED = 'portfolio.redis.updated',
}

// 添加快取失效事件類型
export enum CacheInvalidationEventType {
  ADDRESS_CACHE_INVALIDATED = 'cache.address.invalidated',
}

// 通知事件基類
export class NotificationEvent {
  constructor(
    public readonly type: NotificationEventType,
    public readonly timestamp: Date = new Date(),
  ) {}
}

// 地址活動事件
export class AddressActivityEvent extends NotificationEvent {
  constructor(
    public readonly chain: ChainName,
    public readonly chainId: number,
    public readonly address: string,
    public readonly metadata?: Record<string, any>,
  ) {
    super(NotificationEventType.ADDRESS_ACTIVITY);
  }
}

// NFT 活動事件
export class NftActivityEvent extends NotificationEvent {
  constructor(
    public readonly chain: ChainName,
    public readonly contractAddress: string,
    public readonly tokenId: string,
    public readonly fromAddress: string,
    public readonly toAddress: string,
  ) {
    super(NotificationEventType.NFT_ACTIVITY);
  }
}

// 交易確認事件
export class TransactionMinedEvent extends NotificationEvent {
  constructor(
    public readonly chain: ChainName,
    public readonly txHash: string,
    public readonly fromAddress: string,
    public readonly toAddress: string,
  ) {
    super(NotificationEventType.TRANSACTION_MINED);
  }
}

// 自定義事件
export class CustomEvent extends NotificationEvent {
  constructor(public readonly data: Record<string, any>) {
    super(NotificationEventType.CUSTOM_EVENT);
  }
}

// 投資組合更新事件
export class PortfolioUpdateEvent extends NotificationEvent {
  constructor(
    public readonly chain: ChainName,
    public readonly chainId: number,
    public readonly address: string,
    public readonly portfolioData: any,
    public readonly provider?: ProviderType,
    public readonly ttlSeconds?: number,
  ) {
    super(NotificationEventType.PORTFOLIO_UPDATE);
  }
}

// Redis 中的投資組合數據更新事件，用於觸發 MongoDB 寫入和 Webhook 管理
export class PortfolioRedisUpdatedEvent extends NotificationEvent {
  constructor(
    public readonly chain: ChainName,
    public readonly chainId: number,
    public readonly address: string,
    public readonly portfolioData: any,
    public readonly provider?: ProviderType,
    public readonly mongoTtlSeconds?: number, // MongoDB 特有的 TTL 設置
  ) {
    super(NotificationEventType.PORTFOLIO_REDIS_UPDATED);
  }
}

// 添加快取失效事件資料結構
export interface AddressCacheInvalidatedEvent {
  chain: ChainName;
  chainId: number;
  address: string;
  cacheKey: string;
  cachePattern: string;
  timestamp: number;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheKeyService: CacheKeyService,
  ) {}

  // 發送地址活動事件
  emitAddressActivity(
    chain: ChainName,
    chainId: number,
    address: string,
    metadata?: Record<string, any>,
  ): void {
    const event = new AddressActivityEvent(chain, chainId, address, metadata);
    this.logger.debug(`Emitting address activity event: ${chain}:${chainId}:${address}`);
    this.eventEmitter.emit(NotificationEventType.ADDRESS_ACTIVITY, event);
  }

  // 發送 NFT 活動事件
  emitNftActivity(
    chain: ChainName,
    contractAddress: string,
    tokenId: string,
    fromAddress: string,
    toAddress: string,
  ): void {
    const event = new NftActivityEvent(chain, contractAddress, tokenId, fromAddress, toAddress);
    this.logger.debug(`Emitting NFT activity event: ${chain}:${contractAddress}:${tokenId}`);
    this.eventEmitter.emit(NotificationEventType.NFT_ACTIVITY, event);
  }

  // 發送交易確認事件
  emitTransactionMined(
    chain: ChainName,
    txHash: string,
    fromAddress: string,
    toAddress: string,
  ): void {
    const event = new TransactionMinedEvent(chain, txHash, fromAddress, toAddress);
    this.logger.debug(`Emitting transaction mined event: ${chain}:${txHash}`);
    this.eventEmitter.emit(NotificationEventType.TRANSACTION_MINED, event);
  }

  // 發送自定義事件
  emitCustomEvent(data: Record<string, any>): void {
    const event = new CustomEvent(data);
    this.logger.debug(`Emitting custom event with data: ${JSON.stringify(data)}`);
    this.eventEmitter.emit(NotificationEventType.CUSTOM_EVENT, event);
  }

  // 發送投資組合更新事件
  emitPortfolioUpdate(
    chain: ChainName,
    chainId: number,
    address: string,
    portfolioData: any,
    provider?: ProviderType,
    ttlSeconds?: number,
  ): void {
    const event = new PortfolioUpdateEvent(
      chain,
      chainId,
      address,
      portfolioData,
      provider,
      ttlSeconds,
    );
    this.logger.debug(`Emitting portfolio update event: ${chain}:${chainId}:${address}`);
    this.eventEmitter.emit(NotificationEventType.PORTFOLIO_UPDATE, event);
  }

  // 發送 Redis 中的投資組合數據已更新事件，用於觸發 MongoDB 寫入和 Webhook 管理
  emitPortfolioRedisUpdated(
    chain: ChainName,
    chainId: number,
    address: string,
    portfolioData: any,
    provider?: ProviderType,
    mongoTtlSeconds?: number, // MongoDB 特有的 TTL 設置
  ): void {
    const event = new PortfolioRedisUpdatedEvent(
      chain,
      chainId,
      address,
      portfolioData,
      provider,
      mongoTtlSeconds,
    );
    this.logger.debug(`Emitting portfolio Redis updated event: ${chain}:${chainId}:${address}`);
    this.eventEmitter.emit(NotificationEventType.PORTFOLIO_REDIS_UPDATED, event);
  }

  /**
   * 發出地址快取失效事件
   * @param chain 鏈名稱
   * @param chainId 鏈ID
   * @param address 地址
   */
  async emitAddressCacheInvalidated(
    chain: ChainName,
    chainId: number,
    address: string,
  ): Promise<void> {
    // 創建完整的緩存鍵和模式，使用正確的前綴 "portfolio:"
    const cacheKey = `portfolio:${chain}:${chainId}:${address}`;
    const cachePattern = `portfolio:${chain}:${chainId}:${address}*`;

    const cacheInvalidationEvent: AddressCacheInvalidatedEvent = {
      chain,
      chainId,
      address,
      cacheKey,
      cachePattern,
      timestamp: Date.now(),
    };

    this.logger.debug(
      `準備發送快取失效事件: ${cacheKey}, 事件類型: ${CacheInvalidationEventType.ADDRESS_CACHE_INVALIDATED}`,
    );

    await this.eventEmitter.emitAsync(
      CacheInvalidationEventType.ADDRESS_CACHE_INVALIDATED,
      cacheInvalidationEvent,
    );

    this.logger.debug(
      `已發送快取失效事件: ${chain}:${chainId}:${address}, 時間戳: ${cacheInvalidationEvent.timestamp}`,
    );
  }

  // 監聽 NFT 活動事件並處理
  @OnEvent(NotificationEventType.NFT_ACTIVITY)
  handleNftActivity(event: NftActivityEvent): void {
    try {
      this.logger.debug(
        `Handling NFT activity: ${event.chain}:${event.contractAddress}:${event.tokenId}`,
      );

      // NFT 活動處理邏輯
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle NFT activity: ${errorMessage}`);
    }
  }

  // 監聽交易確認事件並處理
  @OnEvent(NotificationEventType.TRANSACTION_MINED)
  handleTransactionMined(event: TransactionMinedEvent): void {
    try {
      this.logger.debug(`Handling transaction mined: ${event.chain}:${event.txHash}`);

      // 交易確認處理邏輯
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle transaction mined: ${errorMessage}`);
    }
  }

  // 監聽自定義事件並處理
  @OnEvent(NotificationEventType.CUSTOM_EVENT)
  handleCustomEvent(event: CustomEvent): void {
    try {
      this.logger.debug(`Handling custom event: ${JSON.stringify(event.data)}`);

      // 自定義事件處理邏輯
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle custom event: ${errorMessage}`);
    }
  }
}
