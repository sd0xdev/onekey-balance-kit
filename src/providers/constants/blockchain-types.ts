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
export const CHAIN_TO_DEFAULT_PROVIDER_MAP: Record<ChainName, ProviderType> = {
  [ChainName.ETHEREUM]: ProviderType.ALCHEMY,
  [ChainName.SOLANA]: ProviderType.ALCHEMY,
  [ChainName.POLYGON]: ProviderType.ALCHEMY,
  [ChainName.BSC]: ProviderType.ALCHEMY,
};
