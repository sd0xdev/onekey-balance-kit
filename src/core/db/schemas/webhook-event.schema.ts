import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WebhookEventType } from '../../../webhook/dto/webhook-event.dto';

@Schema({ collection: 'webhook_events', timestamps: true })
export class WebhookEvent extends Document {
  @Prop({
    required: true,
    type: String,
    enum: Object.values(WebhookEventType),
  })
  type: WebhookEventType;

  @Prop({ required: true })
  declare id: string;

  @Prop({ required: true, type: Object })
  data: {
    address: string;
    network: string;
    metadata?: Record<string, any>;
  };

  @Prop({ required: true })
  createdAt: string;

  @Prop({ type: Date, default: Date.now })
  receivedAt: Date;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);
