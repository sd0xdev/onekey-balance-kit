/**
 * 以太坊相關常量
 */

/**
 * 預設 Gas 限制
 */
export const DEFAULT_GAS_LIMIT = 21000;

/**
 * 預設 Gas 價格 (20 Gwei)
 */
export const DEFAULT_GAS_PRICE = '20000000000';

/**
 * 以太坊 Chain ID
 */
export enum EthereumChainId {
  MAINNET = 1,
  GOERLI = 5,
  SEPOLIA = 11155111,
}

/**
 * 以太坊幣符號
 */
export const ETH_SYMBOL = 'ETH';

/**
 * 以太坊代幣精度
 */
export const ETH_DECIMALS = 18;
