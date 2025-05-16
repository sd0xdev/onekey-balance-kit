import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { ProvidersModule } from './providers/providers.module';
import { WebhookModule } from './webhook/webhook.module';
import { ConfigsModule, AppConfigService } from './config';
import { BalancesModule } from './balances/balances.module';
import { ChainsModule } from './chains/chains.module';
import blockchainConfig from './config/blockchain.config';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [blockchainConfig],
    }),
    ConfigsModule,
    CoreModule,
    ProvidersModule,
    WebhookModule,
    BalancesModule,
    ChainsModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppConfigService],
})
export class AppModule {}
