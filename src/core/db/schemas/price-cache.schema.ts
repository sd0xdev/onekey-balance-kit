import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'price_cache',
  timestamps: true,
})
export class PriceCache extends Document {
  @Prop({ required: true, index: true })
  symbol: string; // 幣種符號，如 'ETH'

  @Prop({ required: true, index: true })
  chainId: number; // 鏈 ID

  @Prop({ required: true })
  priceUsd: number; // USD 價格

  @Prop({ type: Object })
  metadata?: {
    marketCap?: number;
    volume24h?: number;
    change24h?: number;
    lastUpdated?: string;
    source?: string;
  };

  @Prop({ type: Date, default: Date.now, index: true })
  updatedAt: Date;
}

export const PriceCacheSchema = SchemaFactory.createForClass(PriceCache);

// 創建組合唯一索引
PriceCacheSchema.index({ symbol: 1, chainId: 1 }, { unique: true });

// 創建 TTL 索引，5 分鐘過期
PriceCacheSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 300 });
