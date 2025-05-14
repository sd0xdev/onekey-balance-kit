import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { ChainsModule } from './chains/chains.module';
import { ProvidersModule } from './providers/providers.module';
import { WebhookModule } from './webhook/webhook.module';
import { ConfigsModule, AppConfigService } from './config';

@Module({
  imports: [ConfigsModule, CoreModule, ChainsModule, ProvidersModule, WebhookModule],
  controllers: [AppController],
  providers: [AppService, AppConfigService],
})
export class AppModule {}
