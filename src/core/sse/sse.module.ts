import { Module } from '@nestjs/common';
import { SseController } from './sse.controller';
import { SseSubscriptionService } from './sse-subscription.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [SseController],
  providers: [SseSubscriptionService],
  exports: [SseSubscriptionService],
})
export class SseModule {}
