import { ChainName } from '../../chains/constants';
import {
  ProviderType,
  CHAIN_TO_DEFAULT_PROVIDER_MAP,
  getDefaultProviderForChain,
} from './blockchain-types';

/**
 * 用於提供者裝飾器元數據的常數
 */
export const PROVIDER_METADATA = 'provider_metadata';

/**
 * 推薦使用的提供者映射
 * 為了避免重複維護映射，直接引用 CHAIN_TO_DEFAULT_PROVIDER_MAP
 */
export const CHAIN_TO_PROVIDER_MAP = CHAIN_TO_DEFAULT_PROVIDER_MAP;

export * from './blockchain-types';
export * from './provider-registration';
