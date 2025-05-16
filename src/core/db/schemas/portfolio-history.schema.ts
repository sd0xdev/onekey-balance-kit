import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ChainName } from '../../../chains/constants';
import { ProviderType } from '../../../providers/constants/blockchain-types';
import { NativeBalance, FungibleToken, NftBalance } from './portfolio-snapshot.schema';

/**
 * Time-Series 集合的元數據
 */
export interface PortfolioHistoryMeta {
  chainId: number;
  address: string;
  provider?: ProviderType;
}

@Schema({
  collection: 'portfolio_history',
  // 使用 Mongoose 的 TimeSeriesOptions 定義時間序列集合
  timeseries: {
    timeField: 'updatedAt', // 時間戳欄位
    metaField: 'meta', // 元數據欄位
    granularity: 'seconds', // 精確到秒級
  },
})
export class PortfolioHistory extends Document {
  @Prop({ required: true })
  updatedAt: Date;

  @Prop({ type: Object, required: true })
  meta: PortfolioHistoryMeta;

  @Prop({ required: true })
  chain: ChainName;

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
}

export const PortfolioHistorySchema = SchemaFactory.createForClass(PortfolioHistory);

// 對 meta.address 創建雜湊索引，用於分片
PortfolioHistorySchema.index({ 'meta.address': 'hashed' });

// 對時間戳創建索引
PortfolioHistorySchema.index({ updatedAt: 1 });

// 對時間戳與地址組合創建索引，便於查詢特定地址的歷史
PortfolioHistorySchema.index({ 'meta.chainId': 1, 'meta.address': 1, updatedAt: -1 });
