/**
 * EVM鏈元數據定義
 */
export interface EvmChainMeta {
  chainId: number;
  name: string; // 'ethereum', 'polygon'
  display: string; // 'Ethereum', 'Polygon'
  symbol: string; // 'ETH', 'MATIC'
  decimals: number; // 18
}

/**
 * 支援的EVM鏈元數據表
 */
export const EVM_CHAINS: Record<string, EvmChainMeta> = {
  ETH: { chainId: 1, name: 'ethereum', display: 'Ethereum', symbol: 'ETH', decimals: 18 },
  POLY: { chainId: 137, name: 'polygon', display: 'Polygon', symbol: 'MATIC', decimals: 18 },
  BSC: { chainId: 56, name: 'bsc', display: 'BNB Smart Chain', symbol: 'BNB', decimals: 18 },
  // 之後要新增鏈只需在此添加
};
