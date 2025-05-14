// 提供者標記前綴
export const BLOCKCHAIN_PROVIDER = 'BLOCKCHAIN_PROVIDER';

// 標準鏈類型
export enum StandardChainType {
  ETHEREUM = 'ethereum',
  SOLANA = 'solana',
  BITCOIN = 'bitcoin',
  POLYGON = 'polygon',
  BINANCE_SMART_CHAIN = 'binance_smart_chain',
  AVALANCHE = 'avalanche',
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism',
}

// 標準網絡類型
export enum StandardNetworkType {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  DEVNET = 'devnet',
}
