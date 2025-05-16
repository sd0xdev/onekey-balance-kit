import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ChainName } from '../../../chains/constants';

export interface NftAttribute {
  trait_type: string;
  value: string | number;
}

@Schema({
  collection: 'nft_meta',
  timestamps: true,
})
export class NftMeta extends Document {
  @Prop({ required: true, index: true })
  chainId: number;

  @Prop({ required: true, index: true })
  chain: ChainName;

  @Prop({ required: true, index: true })
  contract: string; // NFT 合約地址

  @Prop({ required: true, index: true })
  tokenId: string; // NFT Token ID

  @Prop()
  name: string; // NFT 名稱

  @Prop()
  symbol: string; // NFT 符號

  @Prop()
  description: string;

  @Prop()
  image: string; // 圖片 URL

  @Prop()
  tokenUri: string; // 元數據 URI

  @Prop({ type: Array, default: [] })
  attributes: NftAttribute[];

  @Prop()
  collectionName: string;

  @Prop()
  floorPrice: number; // 以 USD 計價

  @Prop({ type: Date })
  lastPriceUpdate: Date;

  @Prop({ default: 1 })
  schemaVer: number;
}

export const NftMetaSchema = SchemaFactory.createForClass(NftMeta);

// 創建組合唯一索引，每個 NFT 元數據應該唯一
NftMetaSchema.index({ chainId: 1, contract: 1, tokenId: 1 }, { unique: true });

// 用於查詢特定合約的所有 token 元數據
NftMetaSchema.index({ chainId: 1, contract: 1 });

// 用於基於 name 的全文搜索
NftMetaSchema.index({ name: 'text', collectionName: 'text' });
