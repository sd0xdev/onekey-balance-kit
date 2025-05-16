import { Module, Logger, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';
import { CacheKeyService } from './cache-key.service';
import { CacheMongoService } from './cache-mongo.service';
import { PortfolioCacheListener } from './portfolio-cache.listener';
import { AppConfigService } from '../../config/config.service';
import { ConfigsModule } from '../../config';
import { DbModule } from '../db/db.module';
import { createKeyv } from '@keyv/redis';
import { Keyv } from 'keyv';
import type { RedisClientOptions } from '@redis/client';
import { NotificationModule } from '../../notification/notification.module';

// 自定義 CacheOptions 接口，以支持 isRedisStore 標記
interface CustomCacheOptions {
  ttl: number;
  stores: Keyv<any>[];
  isRedisStore?: boolean;
}

@Global()
@Module({
  imports: [
    ConfigsModule,
    // 導入 DbModule，以便訪問 MongoDB 服務
    DbModule,
    // 導入 NotificationModule，以便使用事件發布服務
    NotificationModule,
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigsModule],
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService): CustomCacheOptions => {
        const logger = new Logger('CacheModule');

        // 使用結構化的 Redis 配置
        const redisConfig = configService.redis;

        // 檢查 Redis 配置是否存在且 host 不為空
        if (redisConfig && redisConfig.host) {
          try {
            logger.log(`Configuring Redis cache: ${redisConfig.host}:${redisConfig.port}`);

            // 創建 Redis 連接字串
            const redisUrl = `redis://:${redisConfig.password}@${redisConfig.host}:${redisConfig.port}/${redisConfig.db}`;

            // 使用 createKeyv 創建 Redis Keyv 客戶端
            const redisKeyv = createKeyv(redisUrl, {
              useUnlink: true, // 使用 UNLINK 代替 DEL，性能更好
              clearBatchSize: 1000, // 批量刪除時的批次大小
            });

            // 返回包含 Redis 設定的配置
            return {
              ttl: 30 * 60, // 秒
              stores: [
                // 使用配置好的 redisKeyv 客戶端
                redisKeyv,
              ],
              // 自定義屬性，用於在 Service 中檢測是否使用 Redis
              isRedisStore: true,
            };
          } catch (error) {
            logger.error(`Failed to initialize Redis cache: ${error.message}`);
            logger.warn('Falling back to memory cache');
          }
        } else {
          logger.warn('Redis configuration not found or incomplete, using memory cache');
        }

        // 如果 Redis 配置不存在或初始化失敗，使用記憶體快取
        return {
          ttl: 5 * 60, // 秒
          stores: [new Keyv({ ttl: 5 * 60 * 1000 })], // 注意這裡是毫秒
          isRedisStore: false, // 明確標記非 Redis 模式
        };
      },
    }),
  ],
  providers: [CacheService, CacheKeyService, CacheMongoService, PortfolioCacheListener],
  exports: [CacheService, CacheKeyService, CacheMongoService, NestCacheModule],
})
export class CacheModule {}
