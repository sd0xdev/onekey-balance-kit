import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { ProvidersModule } from './providers/providers.module';
import { WebhookModule } from './webhook/webhook.module';
import { ConfigsModule, AppConfigService } from './config';
import { BalancesModule } from './balances/balances.module';
import { ConfigModule } from '@nestjs/config';
import { ChainsModule } from './chains/chains.module';
import blockchainConfig from './config/blockchain.config';

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
  ],
  controllers: [AppController],
  providers: [AppService, AppConfigService],
})
export class AppModule {}
