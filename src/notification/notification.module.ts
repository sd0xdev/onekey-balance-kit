import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
