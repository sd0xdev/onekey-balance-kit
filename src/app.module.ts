import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { ChainsModule } from './chains';
import { ProvidersModule } from './providers/providers.module';
import { WebhookModule } from './webhook/webhook.module';
import { ConfigsModule, AppConfigService } from './config';
import { BalancesModule } from './balances/balances.module';
import { ConfigModule } from '@nestjs/config';
import { BlockchainModule } from './chains/blockchain.module';
import blockchainConfig from './config/blockchain.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [blockchainConfig],
    }),
    ConfigsModule,
    CoreModule,
    ChainsModule,
    ProvidersModule,
    WebhookModule,
    BalancesModule,
    BlockchainModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppConfigService],
})
export class AppModule {}
