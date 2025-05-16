import {
  IsNotEmpty,
  IsString,
  IsObject,
  IsOptional,
  ValidateNested,
  IsEnum,
  IsNumber,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum WebhookEventType {
  ADDRESS_ACTIVITY = 'ADDRESS_ACTIVITY',
  TOKEN_ACTIVITY = 'TOKEN_ACTIVITY',
  NFT_ACTIVITY = 'NFT_ACTIVITY',
  MINED_TRANSACTION = 'MINED_TRANSACTION',
  DROPPED_TRANSACTION = 'DROPPED_TRANSACTION',
  GRAPHQL = 'GRAPHQL',
}

export class AddressActivityData {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  network: string;

  @IsNumber()
  @IsOptional()
  chainId?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class AddressActivityItem {
  @IsString()
  @IsNotEmpty()
  blockNum: string;

  @IsString()
  @IsNotEmpty()
  hash: string;

  @IsString()
  @IsNotEmpty()
  fromAddress: string;

  @IsString()
  @IsNotEmpty()
  toAddress: string;

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsString()
  @IsOptional()
  asset?: string;

  @IsString()
  @IsNotEmpty()
  category: string; // 'external', 'internal', 'token', 'erc721', 'erc1155'

  @IsObject()
  @IsOptional()
  rawContract?: {
    address: string;
    decimals?: number;
  };

  @IsObject()
  @IsOptional()
  log?: Record<string, any>;

  @IsArray()
  @IsOptional()
  typeTraceAddress?: string[]; // 只有 internal transfer 時才會出現
}

export class AddressActivityEvent {
  @IsString()
  @IsNotEmpty()
  network: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressActivityItem)
  activity: AddressActivityItem[];
}

export class NftActivityItem {
  @IsString()
  @IsNotEmpty()
  fromAddress: string;

  @IsString()
  @IsNotEmpty()
  toAddress: string;

  @IsString()
  @IsNotEmpty()
  contractAddress: string;

  @IsString()
  @IsOptional()
  erc721TokenId?: string;

  @IsString()
  @IsOptional()
  erc1155TokenId?: string;

  @IsString()
  @IsNotEmpty()
  category: string; // 'erc721' 或 'erc1155'

  @IsObject()
  @IsOptional()
  log?: Record<string, any>;
}

export class NftActivityEvent {
  @IsString()
  @IsNotEmpty()
  network: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NftActivityItem)
  activity: NftActivityItem[];
}

export class MinedTransactionEvent {
  @IsString()
  @IsNotEmpty()
  network: string;

  @IsString()
  @IsNotEmpty()
  hash: string;

  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  blockNum: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsNotEmpty()
  gasUsed: string;
}

export class GraphqlEvent {
  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;
}

export class WebhookEventDto {
  @IsString()
  @IsNotEmpty()
  webhookId: string;

  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(WebhookEventType)
  type: WebhookEventType;

  @IsObject()
  @IsNotEmpty()
  event: AddressActivityEvent | NftActivityEvent | MinedTransactionEvent | GraphqlEvent;

  @IsString()
  @IsNotEmpty()
  createdAt: string;
}
