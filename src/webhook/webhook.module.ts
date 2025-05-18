import { Module, forwardRef, Global } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { CoreModule } from '../core/core.module';
import { NotificationModule } from '../notification/notification.module';
import { BalancesModule } from '../balances/balances.module';
import { WebhookManagementService } from './webhook-management.service';
import { WebhookAddressReconciliationService } from './webhook-address-reconciliation.service';
import { ProvidersModule } from '../providers/providers.module';
import { HttpModule } from '@nestjs/axios';
import { DbModule } from '../core/db/db.module';

@Global()
@Module({
  imports: [CoreModule, NotificationModule, BalancesModule, ProvidersModule, HttpModule, DbModule],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookManagementService, WebhookAddressReconciliationService],
  exports: [WebhookService, WebhookManagementService],
})
export class WebhookModule {}
