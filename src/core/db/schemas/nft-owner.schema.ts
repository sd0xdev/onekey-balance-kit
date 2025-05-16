import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ChainName } from '../../../chains/constants';

@Schema({
  collection: 'nft_owners',
  timestamps: true,
})
export class NftOwner extends Document {
  @Prop({ required: true, index: true })
  chainId: number;

  @Prop({ required: true, index: true })
  chain: ChainName;

  @Prop({ required: true, index: true })
  contract: string; // NFT 合約地址

  @Prop({ required: true, index: true })
  tokenId: string; // NFT Token ID

  @Prop({ required: true, index: true })
  owner: string; // 擁有者地址

  @Prop({ type: String, default: '1' })
  amount: string; // 對於 ERC1155，可能有多個 token

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;

  @Prop({ default: 1 })
  schemaVer: number;
}

export const NftOwnerSchema = SchemaFactory.createForClass(NftOwner);

// 創建組合唯一索引，每個 NFT 只能有一個擁有者
NftOwnerSchema.index({ chainId: 1, contract: 1, tokenId: 1 }, { unique: true });

// 用於查詢用戶擁有的所有 NFT
NftOwnerSchema.index({ chainId: 1, owner: 1, updatedAt: -1 });

// 用於查詢特定合約的所有 token
NftOwnerSchema.index({ chainId: 1, contract: 1, updatedAt: -1 });
