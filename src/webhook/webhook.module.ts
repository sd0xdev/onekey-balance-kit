import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { CoreModule } from '../core/core.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [CoreModule, NotificationModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
