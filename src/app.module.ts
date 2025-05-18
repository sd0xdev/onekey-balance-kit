import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { ProvidersModule } from './providers/providers.module';
import { WebhookModule } from './webhook/webhook.module';
import { ConfigsModule, AppConfigService } from './config';
import { BalancesModule } from './balances/balances.module';
import { ChainsModule } from './chains/chains.module';
import { NotificationModule } from './notification/notification.module';
import { CacheModule } from './core/cache/cache.module';
import { SseModule } from './core/sse/sse.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ConfigsModule,
    CoreModule,
    ProvidersModule,
    WebhookModule,
    BalancesModule,
    ChainsModule,
    ScheduleModule.forRoot(),
    NotificationModule,
    CacheModule,
    SseModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppConfigService],
})
export class AppModule {}
