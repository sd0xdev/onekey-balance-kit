import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChainName } from '../../chains/constants';
import { ProviderType } from '../../providers/constants/blockchain-types';
import { CacheService } from './cache.service';
import { CacheKeyService, CacheKeyPrefix } from './cache-key.service';
import { DbService } from '../db/db.service';
import { PortfolioSnapshot } from '../db/schemas/portfolio-snapshot.schema';
import {
  NotificationService,
  NotificationEventType,
  AddressActivityEvent,
} from '../../notification/notification.service';
import { BalanceResponse } from '../../chains/interfaces/balance-queryable.interface';

/**
 * 緩存與MongoDB查詢服務
 * 負責從Redis或MongoDB獲取數據
 */
@Injectable()
export class CacheMongoService {
  private readonly logger = new Logger(CacheMongoService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheKeyService: CacheKeyService,
    private readonly dbService: DbService,
    private readonly notificationService: NotificationService,
  ) {
    this.logger.log('CacheMongoService initialized');
  }

  /**
   * 根據緩存鍵獲取餘額數據，優先從Redis獲取，若未命中則從MongoDB獲取
   * @param chain 鏈名稱
   * @param chainId 鏈ID
   * @param address 地址
   * @param provider 提供者類型 (可選)
   * @param ttlSeconds 如果從MongoDB獲取，寫入Redis的過期時間 (秒)
   * @returns 符合 BalanceResponse 格式的資料
   */
  async getPortfolioData(
    chain: ChainName,
    chainId: number,
    address: string,
    provider?: ProviderType,
    ttlSeconds?: number,
  ): Promise<BalanceResponse | null> {
    try {
      // 1. 生成緩存鍵
      const cacheKey = this.cacheKeyService.createPortfolioKey(chain, address, provider);

      // 2. 嘗試從Redis獲取
      const cachedData = await this.cacheService.get<BalanceResponse>(cacheKey);
      if (cachedData) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return cachedData;
      }

      // 3. Redis未命中，嘗試從MongoDB獲取
      this.logger.debug(`Cache miss for key: ${cacheKey}, fetching from MongoDB`);
      const dbData = await this.dbService.getPortfolioSnapshot(chainId, address, provider);

      // 4. 如果找到數據，轉換為 BalanceResponse 格式並更新Redis緩存
      if (dbData) {
        this.logger.debug(`Found data in MongoDB, transforming to BalanceResponse format`);

        // 將 MongoDB 數據轉換為 BalanceResponse 格式
        const balanceResponse: BalanceResponse = {
          nativeBalance: {
            symbol: dbData.native.symbol,
            balance: dbData.native.balance,
            decimals: dbData.native.decimals || 18,
            usd: dbData.native.usd,
          },
          tokens: dbData.fungibles
            ? dbData.fungibles.map((token) => ({
                address: token.address,
                symbol: token.symbol,
                name: token.name,
                balance: token.balance,
                decimals: token.decimals,
                usd: token.usd,
                logo: token.logo,
              }))
            : [],
          nfts: dbData.nfts || [],
          updatedAt: Date.now(), // 使用當前時間戳作為更新時間
        };

        // 將轉換後的數據緩存到 Redis
        await this.cacheService.set(cacheKey, balanceResponse, ttlSeconds);

        return balanceResponse;
      }

      this.logger.debug(`No data found for ${cacheKey} in Redis or MongoDB`);
      return null;
    } catch (error) {
      this.logger.error(
        `Error getting portfolio data for ${chain}:${chainId}:${address}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 使某個地址的緩存失效，同時處理Redis和MongoDB
   * @param chain 鏈名稱
   * @param chainId 鏈ID
   * @param address 地址
   */
  async invalidateAddressCache(
    chain: ChainName,
    chainId: number,
    address: string,
  ): Promise<number> {
    try {
      // 1. 構建通配符模式，匹配所有與該地址相關的緩存
      const pattern = `${CacheKeyPrefix.PORTFOLIO}:${chain}:${chainId}:${address}:*`;

      // 2. 先刪除Redis緩存
      const deletedCount = await this.cacheService.deleteByPattern(pattern);
      this.logger.debug(`Invalidated ${deletedCount} Redis keys for pattern: ${pattern}`);

      // 3. 處理 MongoDB 緩存失效，使用 DbService 提供的方法
      const mongoModifiedCount = await this.dbService.invalidateAddressSnapshot(
        chain,
        chainId,
        address,
      );
      this.logger.debug(
        `Invalidated MongoDB cache for ${chain}:${chainId}:${address}, modified ${mongoModifiedCount} records`,
      );

      // 4. 發送地址活動事件，用於通知其他服務
      this.notificationService.emitAddressActivity(chain, chainId, address, {
        action: 'cache_invalidated',
        timestamp: new Date(),
      });

      return deletedCount;
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache for ${chain}:${chainId}:${address}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 使特定提供者的所有緩存失效
   * @param provider 提供者類型
   */
  async invalidateProviderCache(provider: ProviderType): Promise<number> {
    try {
      // 只需刪除Redis緩存，MongoDB會在下次請求時自動更新
      const pattern = `*:*:*:*:${provider}`;
      const deletedCount = await this.cacheService.deleteByPattern(pattern);
      this.logger.debug(`Invalidated ${deletedCount} Redis keys for provider: ${provider}`);
      return deletedCount;
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache for provider ${provider}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 監聽地址活動事件，處理 Redis 和 MongoDB 緩存失效
   */
  @OnEvent(NotificationEventType.ADDRESS_ACTIVITY)
  async handleAddressActivity(event: AddressActivityEvent): Promise<void> {
    try {
      // 只處理指定的活動類型
      if (event.metadata?.action === 'cache_invalidated') {
        // 避免無限循環：當 invalidateAddressCache 方法發出事件時不再處理
        return;
      }

      this.logger.debug(
        `CacheMongoService handling address activity: ${event.chain}:${event.chainId}:${event.address}`,
      );

      const [redisResult, mongoResult] = await Promise.allSettled([
        this.cacheKeyService.invalidateChainAddressCache(event.chain, event.chainId, event.address),
        this.dbService.invalidateAddressSnapshot(event.chain, event.chainId, event.address),
      ]);

      this.logger.debug(
        `Invalidated ${redisResult.status === 'fulfilled' ? redisResult.value : 0} Redis cache entries for ${event.chain}:${event.chainId}:${event.address}`,
      );

      this.logger.debug(
        `Invalidated ${mongoResult.status === 'fulfilled' ? mongoResult.value : 0} MongoDB cache entries for ${event.chain}:${event.chainId}:${event.address}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle address activity in CacheMongoService: ${error.message}`,
        error.stack,
      );
      return;
    }
  }
}
