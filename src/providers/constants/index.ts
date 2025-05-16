import { ChainName } from '../../chains/constants';
import { ProviderType } from './blockchain-types';

/**
 * 用於提供者裝飾器元數據的常數
 */
export const PROVIDER_METADATA = 'provider_metadata';

/**
 * 推薦使用的提供者映射
 */
export const CHAIN_TO_PROVIDER_MAP: Record<ChainName, ProviderType> = {
  [ChainName.ETHEREUM]: ProviderType.ALCHEMY,
  [ChainName.SOLANA]: ProviderType.ALCHEMY,
  [ChainName.POLYGON]: ProviderType.ALCHEMY,
  [ChainName.BSC]: ProviderType.ALCHEMY,
};

export * from './blockchain-types';
export * from './provider-registration';
