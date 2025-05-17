import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/config.service';
import { ConfigsModule } from '../../config';

@Module({
  imports: [ConfigsModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: AppConfigService) => {
        const redisConfig = configService.redis;

        if (!redisConfig || !redisConfig.host) {
          throw new Error('Redis 配置不存在或不完整');
        }

        return new Redis({
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          db: redisConfig.db,
          enableAutoPipelining: true,
          retryStrategy: (times) => Math.min(times * 50, 2000),
        });
      },
      inject: [AppConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
