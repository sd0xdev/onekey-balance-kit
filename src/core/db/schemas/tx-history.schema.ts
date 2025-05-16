import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ChainName } from '../../../chains/constants';

export interface TokenTransfer {
  address: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  value: string;
  from: string;
  to: string;
}

export enum TxType {
  TRANSFER = 'transfer',
  CONTRACT_INTERACTION = 'contract_interaction',
  NFT_TRANSFER = 'nft_transfer',
  SWAP = 'swap',
  OTHER = 'other',
}

@Schema({
  collection: 'tx_history',
  timestamps: true,
})
export class TxHistory extends Document {
  @Prop({ required: true, index: true })
  chainId: number;

  @Prop({ required: true, index: true })
  chain: ChainName;

  @Prop({ required: true, index: true })
  address: string;

  @Prop({ required: true, unique: true, index: true })
  txHash: string;

  @Prop({ required: true })
  blockNumber: number;

  @Prop({ type: Date, required: true, index: true })
  blockTime: Date;

  @Prop({ type: String, enum: Object.values(TxType), default: TxType.OTHER })
  txType: TxType;

  @Prop()
  from: string;

  @Prop()
  to: string;

  @Prop({ type: String })
  value: string;

  @Prop({ type: Object })
  fee?: {
    gas: string;
    gasPrice: string;
    gasUsed?: string;
    total?: string;
  };

  @Prop({ type: Array, default: [] })
  tokenTransfers: TokenTransfer[];

  @Prop({ type: Array, default: [] })
  nftTransfers: {
    contractAddress: string;
    tokenId: string;
    from: string;
    to: string;
    value?: string; // ERC1155 數量
  }[];

  @Prop({ type: Boolean, default: true })
  status: boolean;

  @Prop({ type: Object })
  rawData?: Record<string, any>;

  @Prop({ default: 1 })
  schemaVer: number;
}

export const TxHistorySchema = SchemaFactory.createForClass(TxHistory);

// 主要查詢索引
TxHistorySchema.index({ chainId: 1, address: 1, blockTime: -1 });

// 交易哈希索引
TxHistorySchema.index({ txHash: 1 }, { unique: true });

// 地址與交易類型組合索引
TxHistorySchema.index({ chainId: 1, address: 1, txType: 1, blockTime: -1 });
