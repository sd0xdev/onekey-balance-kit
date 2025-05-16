import { ChainName } from '../../chains/constants';

/**
 * 支援的提供者類型
 */
export enum ProviderType {
  ALCHEMY = 'alchemy',
  RPC = 'rpc',
  INFURA = 'infura',
  QUICKNODE = 'quicknode',
  OKX = 'okx',
}

/**
 * 區塊鏈類型到默認提供者的映射
 */
export const CHAIN_TO_DEFAULT_PROVIDER_MAP: Partial<Record<ChainName, ProviderType>> = {
  // 主網
  [ChainName.ETHEREUM]: ProviderType.ALCHEMY,
  [ChainName.SOLANA]: ProviderType.ALCHEMY,
  [ChainName.POLYGON]: ProviderType.ALCHEMY,
  [ChainName.BSC]: ProviderType.ALCHEMY,

  // 測試網
  [ChainName.ETHEREUM_GOERLI]: ProviderType.ALCHEMY,
  [ChainName.ETHEREUM_SEPOLIA]: ProviderType.ALCHEMY,
  [ChainName.SOLANA_DEVNET]: ProviderType.ALCHEMY,
};

/**
 * 獲取指定鏈的默認提供者
 */
export function getDefaultProviderForChain(chainName: ChainName): ProviderType {
  return CHAIN_TO_DEFAULT_PROVIDER_MAP[chainName] || ProviderType.ALCHEMY;
}
