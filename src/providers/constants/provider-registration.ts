import { Type } from '@nestjs/common';
import { BlockchainProviderInterface } from '../interfaces/blockchain-provider.interface';
import { ChainName } from '../../chains/constants';
import { ProviderType } from './blockchain-types';

/**
 * 提供者註冊介面
 */
export interface ProviderRegistration {
  providerType: ProviderType;
  blockchainType: ChainName;
  providerClass: Type<BlockchainProviderInterface>;
}

/**
 * 提供者描述物件，用於依賴注入
 */
export class ProviderDescriptor {
  constructor(
    public readonly blockchainType: ChainName,
    public readonly providerType: ProviderType,
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
