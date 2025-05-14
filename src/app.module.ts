import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { ChainsModule } from './chains';
import { ProvidersModule } from './providers/providers.module';
import { WebhookModule } from './webhook/webhook.module';
import { ConfigsModule, AppConfigService } from './config';
import { BalancesModule } from './balances/balances.module';

@Module({
  imports: [
    ConfigsModule,
    CoreModule,
    ChainsModule,
    ProvidersModule,
    WebhookModule,
    BalancesModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppConfigService],
})
export class AppModule {}
