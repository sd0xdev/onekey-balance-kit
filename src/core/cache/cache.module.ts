import { Module, Logger } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';
import { AppConfigService } from '../../config/config.service';
import { ConfigsModule } from '../../config';
import { createKeyv } from '@keyv/redis';
import { Keyv } from 'keyv';
import { CacheableMemory } from 'cacheable';

@Module({
  imports: [
    ConfigsModule,
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigsModule],
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => {
        const logger = new Logger('CacheModule');

        // 使用結構化的 Redis 配置
        const redisConfig = configService.redis;

        // 檢查 Redis 配置是否存在且 host 不為空
        if (redisConfig && redisConfig.host) {
          try {
            logger.log(`Configuring Redis cache: ${redisConfig.host}:${redisConfig.port}`);

            // 創建 Redis 連接字串
            const redisUrl = `redis://:${redisConfig.password}@${redisConfig.host}:${redisConfig.port}/${redisConfig.db}`;

            // 返回包含 Redis 設定的配置
            return {
              stores: [
                // primary Redis store
                createKeyv(redisUrl),
              ],
              ttl: 30 * 60, // 秒，不是毫秒
              max: 100,
              isRedisStore: true, // 保留標記以支持現有檢測邏輯
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
          stores: [new Keyv({ store: new CacheableMemory({ ttl: 5 * 60 * 1000, lruSize: 1000 }) })],
          ttl: 5 * 60, // 秒，不是毫秒
          max: 100,
          isRedisStore: false,
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}
