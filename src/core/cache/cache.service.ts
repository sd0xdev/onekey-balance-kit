import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

// 擴展快取接口來處理 reset 方法
interface ExtendedCache extends Cache {
  reset?: () => Promise<void>;
  store?: {
    reset?: () => Promise<void>;
  };
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: ExtendedCache,
    private readonly configService: ConfigService,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      return await this.cacheManager.get<T>(key);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`Error getting cache key ${key}: ${errorMessage}`);
      return null; // 失敗時返回null而不是拋出錯誤，避免連鎖故障
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const defaultTtl = this.configService.get<number>('NATIVE_CACHE_TTL', 30);
      await this.cacheManager.set(key, value, ttl || defaultTtl);
      this.logger.debug(`Cache set for key ${key} with TTL ${ttl || defaultTtl}s`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`Error setting cache for key ${key}: ${errorMessage}`);
      // 快取失敗應該被記錄但不應該阻止應用程序功能
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache deleted for key ${key}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`Error deleting cache for key ${key}: ${errorMessage}`);
    }
  }

  /**
   * 刪除所有快取項目
   * 注意：標準Cache接口不支持reset方法，但某些實現可能支持
   * 如果不支持，會記錄警告日誌
   */
  async reset(): Promise<void> {
    try {
      // 使用類型擴展來處理可能的reset方法
      if (this.cacheManager.reset) {
        await this.cacheManager.reset();
        this.logger.debug('Cache reset successful');
      } else if (this.cacheManager.store && this.cacheManager.store.reset) {
        await this.cacheManager.store.reset();
        this.logger.debug('Cache store reset successful');
      } else {
        this.logger.warn('Cache reset method not available on current cache manager');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`Error resetting cache: ${errorMessage}`);
    }
  }
}
