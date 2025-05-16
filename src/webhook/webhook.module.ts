import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { CoreModule } from '../core/core.module';
import { NotificationModule } from '../notification/notification.module';
import { BalancesModule } from '../balances/balances.module';

@Module({
  imports: [CoreModule, NotificationModule, BalancesModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
