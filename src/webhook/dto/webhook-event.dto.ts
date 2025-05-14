import {
  IsNotEmpty,
  IsString,
  IsObject,
  IsOptional,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum WebhookEventType {
  ADDRESS_ACTIVITY = 'ADDRESS_ACTIVITY',
  TOKEN_ACTIVITY = 'TOKEN_ACTIVITY',
  NFT_ACTIVITY = 'NFT_ACTIVITY',
}

export class AddressActivityData {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  network: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class WebhookEventDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(WebhookEventType)
  type: WebhookEventType;

  @IsString()
  @IsNotEmpty()
  id: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AddressActivityData)
  data: AddressActivityData;

  @IsString()
  @IsNotEmpty()
  createdAt: string;
}
