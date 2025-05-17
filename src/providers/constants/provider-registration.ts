import { Type } from '@nestjs/common';
import { BlockchainProviderInterface } from '../interfaces/blockchain-provider.interface';
import { ChainName } from '../../chains/constants';
import { ProviderType } from './blockchain-types';

/**
 * 提供者註冊介面
 */
export interface ProviderRegistration {
  providerType: ProviderType | string;
  blockchainType: ChainName | string;
  providerClass: Type<BlockchainProviderInterface>;
  originalBlockchainType?: ChainName | ChainName[] | string | string[]; // 可選參數，保存原始區塊鏈類型
}

/**
 * 提供者描述物件，用於依賴注入
 */
export class ProviderDescriptor {
  constructor(
    public readonly blockchainType: ChainName | string,
    public readonly providerType: ProviderType | string,
  ) {}

  toString(): string {
    return `${this.blockchainType}:${this.providerType}`;
  }

  static fromString(descriptor: string): ProviderDescriptor {
    const [blockchainType, providerType] = descriptor.split(':') as [ChainName, ProviderType];
    return new ProviderDescriptor(blockchainType, providerType);
  }
}

/**
 * 提供者註冊 token
 */
export const PROVIDERS_TOKEN = 'REGISTERED_PROVIDERS';
