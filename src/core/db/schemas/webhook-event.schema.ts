import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WebhookEventType } from '../../../webhook/dto/webhook-event.dto';
import { ChainName, CHAIN_INFO_MAP } from '../../../chains/constants';

// 從 constants 中獲取所有支持的鏈 ID
const SUPPORTED_CHAIN_IDS = Object.values(CHAIN_INFO_MAP).map((chain) => chain.id);

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

  @Prop({ required: true })
  webhookId: string;

  @Prop({ required: true, type: Object })
  event: {
    network?: string;
    activity?: Array<{
      blockNum?: string;
      hash?: string;
      fromAddress?: string;
      toAddress?: string;
      value?: number;
      asset?: string;
      category?: string;
      rawContract?: {
        address: string;
        decimals?: number;
      };
      log?: Record<string, any>;
      typeTraceAddress?: string[];
      contractAddress?: string;
      erc721TokenId?: string;
      erc1155TokenId?: string;
    }>;
    hash?: string;
    from?: string;
    to?: string;
    blockNum?: string;
    status?: string;
    gasUsed?: string;
    data?: Record<string, any>;
  };

  @Prop({ required: true })
  createdAt: string;

  @Prop({ type: Date, default: Date.now })
  receivedAt: Date;

  // 計算屬性：鏈類型，根據 network 識別符映射
  @Prop({ type: String, enum: Object.values(ChainName) })
  chainType?: ChainName;

  // 計算屬性：鏈 ID
  @Prop({ type: Number, enum: SUPPORTED_CHAIN_IDS })
  chainId?: number;

  // 計算屬性：是否為主網
  @Prop({ type: Boolean })
  isMainnet?: boolean;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);

// 添加索引以優化查詢效能
WebhookEventSchema.index({ webhookId: 1 });
WebhookEventSchema.index({ type: 1 });
WebhookEventSchema.index({ createdAt: 1 });
WebhookEventSchema.index({ receivedAt: 1 });
WebhookEventSchema.index({ chainType: 1 });
WebhookEventSchema.index({ chainId: 1 });
WebhookEventSchema.index({ isMainnet: 1 });

// 複合索引
WebhookEventSchema.index({ webhookId: 1, createdAt: -1 });
WebhookEventSchema.index({ type: 1, createdAt: -1 });
WebhookEventSchema.index({ 'event.network': 1, createdAt: -1 });
WebhookEventSchema.index({ chainType: 1, createdAt: -1 });
WebhookEventSchema.index({ chainId: 1, type: 1 });
WebhookEventSchema.index({ isMainnet: 1, chainType: 1 });

// 交易相關索引
WebhookEventSchema.index({ 'event.hash': 1 });
WebhookEventSchema.index({ 'event.from': 1 });
WebhookEventSchema.index({ 'event.to': 1 });
