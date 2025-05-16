import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import type { RedisClientType } from 'redis';
import type { Keyv as KeyvType } from 'keyv';
import { AppConfigService } from '../../config/config.service';

/**
 * 擴展 Cache 介面，支援 v6 stores 陣列與 reset()
 */
interface ExtendedCacheV6 extends Cache {
  reset?: () => Promise<void>;
  stores: KeyvType<any>[];
  isRedisStore?: boolean;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number;
  private readonly isUsingRedis: boolean;
  private readonly redisClient?: RedisClientType;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: ExtendedCacheV6,
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
    this.logger.log(`Detect Redis Store: ${this.isUsingRedis}`);

    if (this.isUsingRedis) {
      this.logger.log('Using Redis for caching');
      this.redisClient = this.getNativeRedisClient()!;
    } else {
      this.logger.warn('Using memory cache - Redis client not detected');
    }
  }

  /**
   * 偵測是否為 Redis Store (Keyv adapter)
   */
  private detectRedisStore(): boolean {
    if (this.cacheManager.isRedisStore) return true;
    const stores = this.cacheManager.stores;
    if (!Array.isArray(stores)) return false;
    for (const s of stores) {
      const storeObj = (s as any).opts?.store;
      // Keyv Redis 內部客戶端儲存在 _client
      if (storeObj?._client) {
        return true;
      }
    }
    return false;
  }

  /**
   * 取得原生 Redis 客戶端
   */
  private getNativeRedisClient(): RedisClientType | null {
    const stores = this.cacheManager.stores;
    if (!Array.isArray(stores)) return null;
    for (const s of stores) {
      const client = (s as any).opts?.store?._client;
      if (client) return client;
    }
    return null;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      this.logger.debug(`Getting cache key: ${key}`);
      const data = await this.cacheManager.get<T>(key);
      return data ?? null;
    } catch (err) {
      this.logger.error(
        `Error getting cache key ${key}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const ttlSec = ttlSeconds ?? this.defaultTtl;
      const ttlMs = ttlSec * 1000;
      await this.cacheManager.set(key, value, ttlMs);
      this.logger.debug(`Cache set for key ${key} with TTL ${ttlSec}s`);
    } catch (err) {
      this.logger.error(
        `Error setting cache key ${key}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache deleted for key ${key}`);
    } catch (err) {
      this.logger.error(
        `Error deleting cache key ${key}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * 批次刪除符合模式的 Redis keys (使用 SCAN + UNLINK)
   */
  async deleteByPattern(pattern: string): Promise<number> {
    const client = this.getNativeRedisClient();
    if (!client) {
      this.logger.warn(`Pattern deletion not supported in memory mode: ${pattern}`);
      return 0;
    }
    let cursor = '0';
    let count = 0;
    do {
      const { cursor: next, keys } = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      cursor = next;
      if (keys.length) {
        await client.unlink(keys);
        count += keys.length;
      }
    } while (cursor !== '0');

    this.logger.debug(`Deleted ${count} keys matching pattern: ${pattern}`);
    return count;
  }

  /**
   * 清空所有快取 (clear tiered stores)
   */
  async reset(): Promise<void> {
    const fn = (this.cacheManager as any).reset;
    if (typeof fn === 'function') {
      await fn.call(this.cacheManager);
      this.logger.debug('Cache reset successful');
    } else {
      this.logger.warn('reset() not available on cache manager');
    }
  }

  /**
   * 回傳當前快取類型
   */
  getCacheType(): 'Redis' | 'Memory' {
    return this.isUsingRedis ? 'Redis' : 'Memory';
  }
}
