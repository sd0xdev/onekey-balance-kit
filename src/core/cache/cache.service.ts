import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import type { RedisClientType } from 'redis';
import type { Keyv } from 'keyv';
import { AppConfigService } from '../../config/config.service';
import { ErrorCode } from '../../common/constants/error-codes';
import { ApplicationException } from '../../common/exceptions/application.exception';

// 定義一個新的接口來擴展 Cache 接口
// 不繼承 Cache，避免類型衝突
interface CustomCacheManager {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  stores?: Array<{
    opts?: {
      store?: {
        _redis?: RedisClientType;
      };
    };
  }>;
  isRedisStore?: boolean;
  reset?(): Promise<void>;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number;
  private readonly isUsingRedis: boolean;
  private reconnectTimer?: NodeJS.Timeout;
  private readonly reconnectInterval = 5000; // 5秒重連
  private redisClient: RedisClientType | null = null;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache & Partial<CustomCacheManager>,
    private readonly configService: AppConfigService,
  ) {
    const cfg = this.configService.redis;
    if (cfg) {
      this.logger.log(
        `Redis configuration found: host=${cfg.host}, port=${cfg.port}, db=${cfg.db}`,
      );
    } else {
      this.logger.warn('No Redis configuration found in AppConfigService');
    }

    const envTtl = parseInt(process.env.CACHE_TTL ?? '', 10);
    this.defaultTtl = !isNaN(envTtl) && envTtl > 0 ? envTtl : 300;
    this.logger.log(`Default cache TTL: ${this.defaultTtl} seconds`);

    this.isUsingRedis = this.detectRedisStore();
    this.logger.log(`Using Redis for caching: ${this.isUsingRedis}`);
    this.logger.log(`CacheManager type: ${this.cacheManager.constructor.name}`);

    // 如果使用 Redis，嘗試獲取 Redis 客戶端
    if (this.isUsingRedis) {
      this.redisClient = this.getNativeRedisClient();
      if (this.redisClient) {
        this.logger.log('Redis client retrieved successfully');

        // 設置事件監聽器
        this.setupRedisEventListeners();
      } else {
        this.logger.warn('Redis client not available - check configuration');
      }
    } else {
      this.logger.warn('Using memory cache - Redis client not detected');
    }
  }

  /**
   * 設置 Redis 事件監聽器
   */
  private setupRedisEventListeners(): void {
    if (!this.redisClient) return;

    // 設置錯誤事件監聽器
    this.redisClient.on('error', (err: Error) => {
      this.logger.error(`Redis client error: ${err.message}`);
      this.logger.log('Will attempt to reconnect');
      // 使用非同步安全的方式處理
      setTimeout(() => this.scheduleReconnect(), 0);
    });

    // 設置連接成功事件監聽器
    this.redisClient.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    // 設置重連事件監聽器
    this.redisClient.on('reconnecting', () => {
      this.logger.log('Redis client reconnecting...');
    });
  }

  async onModuleInit() {
    if (this.isUsingRedis && this.redisClient) {
      // Redis 連接檢查
      try {
        const pingResult = await this.redisClient.ping();
        this.logger.log(`Redis server responded to PING: ${pingResult}`);
      } catch (error) {
        this.logger.error(`Redis connection check failed: ${error}`);
        this.scheduleReconnect();
      }
    }
  }

  async onModuleDestroy() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // 關閉 Redis 客戶端連接
    if (this.redisClient && this.redisClient.isOpen) {
      try {
        await this.redisClient.quit();
        this.logger.log('Redis client disconnected gracefully');
      } catch (err) {
        this.logger.error(`Error disconnecting Redis client: ${err}`);
      }
    }
  }

  /**
   * 安排重連機制
   */
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // 定義一個單獨的異步函數
    const attemptReconnect = async () => {
      this.logger.log('Attempting to reconnect to Redis...');
      if (this.redisClient) {
        try {
          if (!this.redisClient.isOpen) {
            await this.redisClient.connect();
          }
          const pingResult = await this.redisClient.ping();
          this.logger.log(`Redis reconnected successfully: ${pingResult}`);
        } catch (err) {
          this.logger.error(`Redis reconnection failed: ${err}`);
          this.scheduleReconnect();
        }
      } else {
        // 嘗試重新獲取 Redis 客戶端
        this.redisClient = this.getNativeRedisClient();
        if (!this.redisClient) {
          this.logger.error('Could not retrieve Redis client during reconnect');
          this.scheduleReconnect();
        } else {
          try {
            const pingResult = await this.redisClient.ping();
            this.logger.log(`New Redis client connected successfully: ${pingResult}`);
            // 重新設置事件監聽器
            this.setupRedisEventListeners();
          } catch (err) {
            this.logger.error(`New Redis client connection failed: ${err}`);
            this.scheduleReconnect();
          }
        }
      }
    };

    // 非異步回調中調用異步函數
    this.reconnectTimer = setTimeout(() => {
      void attemptReconnect();
    }, this.reconnectInterval);
  }

  /**
   * 偵測是否為 Redis Store (優先使用 @Module 中配置的標記)
   */
  private detectRedisStore(): boolean {
    // 首先檢查 module 中設定的標記
    if (this.cacheManager.isRedisStore !== undefined) {
      return this.cacheManager.isRedisStore;
    }

    // v6 之後用 stores[] 陣列
    const stores = this.cacheManager.stores ?? [];
    if (!Array.isArray(stores) || stores.length === 0) {
      return false;
    }

    // 使用 any 類型避免 TypeScript 錯誤
    return stores.some((store: any) => {
      try {
        // 檢查多種可能的路徑，使用類型斷言避免 TypeScript 錯誤
        const redisExists =
          store?.opts?.store?._redis ||
          store?._store?._redis ||
          store?.opts?.store?._client ||
          store?._store?._client ||
          store?.opts?.store?.client ||
          store?._store?.client;

        return redisExists !== undefined && redisExists !== null;
      } catch (e) {
        // 如果訪問路徑時發生錯誤，返回 false
        return false;
      }
    });
  }

  /**
   * 取得原生 Redis 客戶端
   * 在 cache-manager v6 + Keyv 架構中，Redis 客戶端位置可能在多個路徑
   */
  private getNativeRedisClient(): RedisClientType | null {
    const stores = this.cacheManager.stores ?? [];
    if (!Array.isArray(stores) || stores.length === 0) {
      return null;
    }

    for (const store of stores) {
      try {
        // 使用 any 類型避免 TypeScript 錯誤
        const storeAny = store as any;

        // 依序檢查可能的路徑
        const redisClient =
          storeAny?.opts?.store?._redis ||
          storeAny?._store?._redis ||
          storeAny?.opts?.store?._client ||
          storeAny?._store?._client ||
          storeAny?.opts?.store?.client ||
          storeAny?._store?.client;

        if (redisClient) {
          return redisClient as RedisClientType;
        }
      } catch (e) {
        // 如果訪問路徑時發生錯誤，繼續嘗試下一個 store
        continue;
      }
    }
    return null;
  }

  /**
   * 獲取一個緩存值，如果不存在則返回 null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      this.logger.debug(`Getting cache key: ${key}`);
      const data = await this.cacheManager.get<T>(key);
      return data ?? null;
    } catch (err) {
      this.logger.error(
        `Error getting cache key ${key}: ${err instanceof Error ? err.message : err}`,
      );
      throw new ApplicationException(
        ErrorCode.CACHE_GET_FAILED,
        `Failed to get cache: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 設置一個緩存值
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const ttlSec = ttlSeconds ?? this.defaultTtl;
      await this.cacheManager.set(key, value, ttlSec * 1000); // 轉換為毫秒
      this.logger.debug(`Cache set for key ${key} with TTL ${ttlSec}s`);
    } catch (err) {
      this.logger.error(
        `Error setting cache key ${key}: ${err instanceof Error ? err.message : err}`,
      );
      throw new ApplicationException(
        ErrorCode.CACHE_SET_FAILED,
        `Failed to set cache: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 刪除一個緩存值
   */
  async delete(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache deleted for key ${key}`);
    } catch (err) {
      this.logger.error(
        `Error deleting cache key ${key}: ${err instanceof Error ? err.message : err}`,
      );
      throw new ApplicationException(
        ErrorCode.CACHE_SET_FAILED,
        `Failed to delete cache: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 批次刪除符合模式的 Redis keys (使用 SCAN + UNLINK)
   */
  async deleteByPattern(pattern: string): Promise<number> {
    // 如果不是 Redis 存儲，則不支持模式刪除
    if (!this.isUsingRedis) {
      this.logger.warn(`Pattern deletion not supported in memory mode: ${pattern}`);
      return 0;
    }

    // 獲取 Redis 客戶端
    const redis = this.redisClient ?? this.getNativeRedisClient();
    if (!redis) {
      this.logger.warn(`Redis client not available, can't delete pattern: ${pattern}`);
      return 0;
    }

    try {
      // 使用 SCAN + UNLINK 非阻塞方式刪除
      let cursor = '0';
      let total = 0;
      do {
        // 檢查 Redis 客戶端是否仍然連接
        if (!redis.isOpen) {
          this.logger.warn('Redis client is closed, trying to reconnect');
          try {
            await redis.connect();
          } catch (err) {
            this.logger.error(`Failed to reconnect Redis: ${err}`);
            this.scheduleReconnect();
            return total;
          }
        }

        const { cursor: next, keys } = await redis.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        cursor = next;
        if (keys.length) {
          await redis.unlink(keys); // UNLINK 非阻塞刪除
          total += keys.length;
        }
      } while (cursor !== '0');

      this.logger.debug(`Deleted ${total} keys matching pattern: ${pattern}`);
      return total;
    } catch (err) {
      this.logger.error(`Error deleting keys by pattern ${pattern}: ${err}`);
      this.scheduleReconnect(); // 發生錯誤時嘗試重連
      return 0;
    }
  }

  /**
   * 清空所有快取
   */
  async reset(): Promise<void> {
    try {
      // 檢查是否有 reset() 方法 (Keyv v6 提供)
      if (typeof this.cacheManager.reset === 'function') {
        await this.cacheManager.reset(); // 會輪詢每一層 store.clear()
        this.logger.debug('Cache reset successful');
      } else {
        // 無法使用 reset() 時的替代方案
        if (this.isUsingRedis && this.redisClient) {
          await this.redisClient.flushDb();
          this.logger.debug('Cache reset via FLUSHDB');
        } else {
          this.logger.warn('No available method to reset cache');
        }
      }
    } catch (err) {
      this.logger.error(`Error resetting cache: ${err}`);
    }
  }

  /**
   * 回傳當前快取類型
   */
  getCacheType(): 'Redis' | 'Memory' {
    return this.isUsingRedis ? 'Redis' : 'Memory';
  }

  /**
   * 檢查 Redis 客戶端連接狀態
   */
  async isRedisConnected(): Promise<boolean> {
    if (!this.isUsingRedis || !this.redisClient) return false;

    try {
      if (!this.redisClient.isOpen) return false;
      await this.redisClient.ping();
      return true;
    } catch (err) {
      this.logger.error(`Redis connection check failed: ${err}`);
      return false;
    }
  }
}
