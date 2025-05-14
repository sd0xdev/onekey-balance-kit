import { Module, Logger } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('CacheModule');
        const redisUrl = configService.get<string>('REDIS_URL');

        if (!redisUrl) {
          logger.warn('Redis URL not configured, falling back to memory cache');
          return {
            ttl: configService.get<number>('NATIVE_CACHE_TTL', 30),
          };
        }

        // Redis 配置改為只使用簡單的記憶體快取，此問題將在後續修復
        logger.warn('Redis support temporarily disabled due to type issues, using memory cache');
        return {
          ttl: configService.get<number>('NATIVE_CACHE_TTL', 30),
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}
