import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ChainName } from '../../../chains/constants';
import { ProviderType } from '../../../providers/constants/blockchain-types';

export interface NativeBalance {
  symbol: string;
  balance: string;
  decimals?: number;
  usd?: number;
}

export interface FungibleToken {
  address: string;
  symbol: string;
  name?: string;
  balance: string;
  decimals: number;
  usd?: number;
  logo?: string;
}

export interface NftBalance {
  address: string;
  tokenId: string;
  name?: string;
  symbol?: string;
  image?: string;
  balance: string;
  floorPrice?: number;
}

@Schema({
  collection: 'portfolio_snapshot',
  timestamps: true, // 自動添加 createdAt 和 updatedAt
  versionKey: 'schemaVer', // 使用 schemaVer 替代默認的 __v
})
export class PortfolioSnapshot extends Document {
  @Prop({ required: true, index: true })
  chain: ChainName;

  @Prop({ required: true, index: true })
  chainId: number;

  @Prop({ required: true, index: true })
  address: string;

  @Prop({ type: String, enum: Object.values(ProviderType), index: true })
  provider?: ProviderType;

  @Prop({ type: Object, required: true })
  native: NativeBalance;

  @Prop({ type: Array, default: [] })
  fungibles: FungibleToken[];

  @Prop({ type: Array, default: [] })
  nfts: NftBalance[];

  @Prop({ default: 0 })
  blockNumber: number;

  @Prop({ default: 1 })
  schemaVer: number;

  @Prop({
    type: Date,
    required: true,
    default: function () {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30); // 預設 30 分鐘後過期
      return now;
    },
    validate: {
      validator: function (v: Date) {
        return v > new Date(); // 確保過期時間在當前時間之後
      },
      message: '過期時間必須在當前時間之後',
    },
  })
  expiresAt: Date; // 自定義過期時間字段，默認 30 分鐘後過期
}

export const PortfolioSnapshotSchema = SchemaFactory.createForClass(PortfolioSnapshot);

// 創建複合索引 (主要查詢路徑)
PortfolioSnapshotSchema.index({ chainId: 1, address: 1, provider: 1 }, { unique: true });

// 創建時間索引 (用於 TTL 和時間排序)
PortfolioSnapshotSchema.index({ updatedAt: -1 });

// 設置 TTL 索引 (30天無更新自動刪除)
PortfolioSnapshotSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// 設置自定義過期時間索引
PortfolioSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
