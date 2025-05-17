import { SetMetadata } from '@nestjs/common';
import { ProviderType } from '../constants/blockchain-types';
import { PROVIDER_METADATA } from '../constants/provider-metadata';
import { ChainName } from '../../chains/constants';

/**
 * 區塊鏈類型元數據的常數
 */
export const BLOCKCHAIN_TYPE_METADATA = 'blockchain_type_metadata';

/**
 * 全局提供者映射，保存提供者類型和區塊鏈類型到服務類的映射
 */
export const GLOBAL_PROVIDER_MAP = new Map<string, any>();

/**
 * 提供者選項介面
 */
export interface ProviderOptions {
  blockchainType: ChainName | ChainName[] | string | string[];
  providerType: ProviderType | string;
}

/**
 * 提供者元數據介面
 */
export interface ProviderMeta {
  blockchainTypes: Set<ChainName | string>;
  providerType: ProviderType | string;
  blockchainType: ChainName | ChainName[] | string | string[]; // 保存原始區塊鏈類型
}

/**
 * Provider 裝飾器，用於標記區塊鏈提供者類
 * 支援指定多個區塊鏈類型
 * @param options 提供者選項（包含區塊鏈類型和提供者類型）
 * @returns 類裝飾器
 */
export const Provider = (options: ProviderOptions) => {
  const { blockchainType, providerType } = options;
  // 將單個區塊鏈類型轉換為數組
  const blockchainTypes = Array.isArray(blockchainType) ? blockchainType : [blockchainType];

  return (target: any) => {
    // 設置元數據，保存完整的選項
    const metadata: ProviderMeta = {
      blockchainTypes: new Set(blockchainTypes),
      providerType,
      blockchainType, // 保存原始區塊鏈類型
    };

    Reflect.defineMetadata(PROVIDER_METADATA, metadata, target);

    // 為每個區塊鏈類型建立索引
    blockchainTypes.forEach((type) => {
      const key = `${type}:${providerType}`;
      GLOBAL_PROVIDER_MAP.set(key, target);
    });
  };
};

/**
 * 區塊鏈類型裝飾器，用於標記提供者支援的區塊鏈類型
 * 為了向後兼容性而保留
 * @param blockchainType 區塊鏈類型 (ethereum, solana 等)
 */
export const BlockchainTypeDecorator = (blockchainType: string): ClassDecorator => {
  return SetMetadata(BLOCKCHAIN_TYPE_METADATA, blockchainType);
};
