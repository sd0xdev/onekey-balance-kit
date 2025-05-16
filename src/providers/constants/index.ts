/**
 * 用於提供者裝飾器元數據的常數
 */
export const PROVIDER_METADATA = 'provider_metadata';

/**
 * 將代幣符號映射到對應的提供者
 */
export const SYMBOL_TO_PROVIDER_MAP: Record<string, string> = {
  // 這裡可以定義符號到提供者的映射
  // 例如 'eth': 'alchemy'
  eth: 'alchemy',
  sol: 'solana-rpc',
  // 其他映射...
};

export * from './blockchain-types';
export * from './provider-registration';
