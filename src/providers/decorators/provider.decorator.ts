import { SetMetadata } from '@nestjs/common';
import { ProviderType } from '../constants/blockchain-types';
import { PROVIDER_METADATA } from '../constants/provider-metadata';
import { ChainName } from '../../chains/constants';

/**
 * 區塊鏈類型元數據的常數
 */
export const BLOCKCHAIN_TYPE_METADATA = 'blockchain_type_metadata';

export interface ProviderOptions {
  blockchainType: ChainName | string;
  providerType: ProviderType | string;
}

/**
 * Provider 裝飾器，用於標記區塊鏈提供者類
 * @param options 提供者選項（包含區塊鏈類型和提供者類型）
 * @returns 類裝飾器
 */
export const Provider = (options: ProviderOptions) => {
  return SetMetadata(PROVIDER_METADATA, options);
};

/**
 * 區塊鏈類型裝飾器，用於標記提供者支援的區塊鏈類型
 * @param blockchainType 區塊鏈類型 (ethereum, solana 等)
 */
export const BlockchainTypeDecorator = (blockchainType: string): ClassDecorator => {
  return SetMetadata(BLOCKCHAIN_TYPE_METADATA, blockchainType);
};
