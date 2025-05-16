import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import type { RedisClientType } from 'redis';
import type { Keyv } from 'keyv';
import { ErrorCode } from '../../common/constants/error-codes';
import { ApplicationException } from '../../common/exceptions/application.exception';

// 定義自定義Cache管理器類型
type CustomCache = Cache & {
  isRedisStore?: boolean;
  stores?: any[];
  reset?: () => Promise<void>;
};

/**
 * 緩存類型
 */
export enum CacheType {
  MEMORY = 'memory',
  REDIS = 'redis',
}

/**
 * 緩存服務
 * 提供了對緩存的統一訪問和管理
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number;
  private readonly isUsingRedis: boolean;
  private reconnectTimer?: NodeJS.Timeout;
  private readonly reconnectInterval = 5000; // 5秒重連

  // Redis 客戶端引用
  private redisClient: RedisClientType | null = null;
  private isInitialized = false; // 追踪是否已初始化連接

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: CustomCache,
    private readonly configService: ConfigService,
  ) {
    this.defaultTtl = Number(this.configService.get('CACHE_TTL', 300));
    this.isUsingRedis = this.detectRedisStore();
    this.logger.log(`Using Redis for caching: ${this.isUsingRedis}`);

    if (this.cacheManager && this.cacheManager.constructor) {
      this.logger.log(`CacheManager type: ${this.cacheManager.constructor.name}`);
    } else {
      this.logger.warn('CacheManager is not properly initialized');
    }

    // 檢查Redis配置
    const redisHost = this.configService.get('REDIS_HOST');
    const redisPort = this.configService.get('REDIS_PORT');
    const redisDb = this.configService.get('REDIS_DB');

    if (redisHost && redisPort) {
      this.logger.log(
        `Redis configuration found: host=${redisHost}, port=${redisPort}, db=${redisDb || 0}`,
      );
    } else {
      this.logger.warn('No Redis configuration found in environment variables');
    }

    // 懶啟動模式：不再立即獲取Redis客戶端和設置事件監聽器
    // 第一次使用時才會初始化
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

  /**
   * 確保Redis連接 - 懶啟動核心方法
   */
  private async ensureConnection(): Promise<boolean> {
    // 如果不使用Redis或已檢查過初始化，直接返回
    if (!this.isUsingRedis) return false;

    // 第一次初始化
    if (!this.redisClient) {
      this.logger.log('Initializing Redis connection (lazy initialization)');
      this.redisClient = this.getNativeRedisClient();

      if (this.redisClient) {
        this.setupRedisEventListeners();
      } else {
        this.logger.warn('Redis client not available during lazy initialization');
        return false;
      }
    }

    // 確保連接狀態
    if (!this.redisClient) return false;

    try {
      if (!this.redisClient.isOpen) {
        this.logger.debug('Redis client not connected, connecting now...');
        await this.redisClient.connect();
      }
      return true;
    } catch (err) {
      this.logger.warn(`Redis connection failed during lazy initialization: ${err}`);
      this.scheduleReconnect();
      return false;
    }
  }

  // onModuleInit 不再主動檢查連接
  async onModuleInit() {
    // 懶啟動模式：不再主動初始化Redis連接
    this.logger.log('Cache service initialized in lazy mode');
    // 添加一個空的 await 語句以滿足 require-await 規則
    await Promise.resolve();
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
    // 首先檢查 cacheManager 是否存在
    if (!this.cacheManager) {
      this.logger.warn('Cache manager is not initialized');
      return false;
    }

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
        const storeAny = store;

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
      // 懶啟動：使用前確保連接
      await this.ensureConnection();

      this.logger.debug(`Getting cache key: ${key}`);
      const data = await this.cacheManager.get<T>(key);
      return data ?? null;
    } catch (err) {
      this.logger.error(
        `Error getting cache key ${key}: ${err instanceof Error ? err.message : err}`,
      );
      throw new ApplicationException(
        ErrorCode.CACHE_GET_FAILED,
        `獲取快取失敗: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 設置一個緩存值
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      // 懶啟動：使用前確保連接
      await this.ensureConnection();

      const ttlSec = ttlSeconds ?? this.defaultTtl;
      await this.cacheManager.set(key, value, ttlSec * 1000); // 轉換為毫秒
      this.logger.debug(`Cache set for key ${key} with TTL ${ttlSec}s`);
    } catch (err) {
      this.logger.error(
        `Error setting cache key ${key}: ${err instanceof Error ? err.message : err}`,
      );
      throw new ApplicationException(
        ErrorCode.CACHE_SET_FAILED,
        `設置快取失敗: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 刪除一個緩存值
   */
  async delete(key: string): Promise<void> {
    try {
      // 懶啟動：使用前確保連接
      await this.ensureConnection();

      await this.cacheManager.del(key);
      this.logger.debug(`Cache deleted for key ${key}`);
    } catch (err) {
      this.logger.error(
        `Error deleting cache key ${key}: ${err instanceof Error ? err.message : err}`,
      );
      throw new ApplicationException(
        ErrorCode.CACHE_SET_FAILED,
        `設置快取失敗: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 批次刪除符合模式的 Redis keys (使用 SCAN + UNLINK)
   */
  async deleteByPattern(pattern: string): Promise<number> {
    // 懶啟動：使用前確保連接
    const connected = await this.ensureConnection();

    // 如果不是 Redis 存儲，則不支持模式刪除
    if (!this.isUsingRedis || !connected) {
      this.logger.warn(`Pattern deletion not supported: ${pattern}`);
      return 0;
    }

    // 獲取 Redis 客戶端
    const redis = this.redisClient;
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
      // 懶啟動：使用前確保連接
      const connected = await this.ensureConnection();

      // 檢查是否有 reset() 方法 (Keyv v6 提供)
      if (typeof this.cacheManager.reset === 'function') {
        await this.cacheManager.reset(); // 會輪詢每一層 store.clear()
        this.logger.debug('Cache reset successful');
      } else {
        // 無法使用 reset() 時的替代方案
        if (this.isUsingRedis && connected && this.redisClient) {
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
