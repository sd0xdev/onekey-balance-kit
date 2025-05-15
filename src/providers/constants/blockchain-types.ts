/**
 * 支援的區塊鏈類型
 */
export enum BlockchainType {
  ETHEREUM = 'ethereum',
  SOLANA = 'solana',
  BITCOIN = 'bitcoin',
}

/**
 * 支援的提供者類型
 */
export enum ProviderType {
  ALCHEMY = 'alchemy',
  RPC = 'rpc',
  INFURA = 'infura',
  QUICKNODE = 'quicknode',
}

/**
 * 區塊鏈符號到類型的映射
 */
export const SYMBOL_TO_BLOCKCHAIN_MAP: Record<string, BlockchainType> = {
  eth: BlockchainType.ETHEREUM,
  sol: BlockchainType.SOLANA,
  btc: BlockchainType.BITCOIN,
};

/**
 * 區塊鏈類型到默認提供者的映射
 */
export const BLOCKCHAIN_TO_DEFAULT_PROVIDER_MAP: Record<BlockchainType, ProviderType> = {
  [BlockchainType.ETHEREUM]: ProviderType.ALCHEMY,
  [BlockchainType.SOLANA]: ProviderType.RPC,
  [BlockchainType.BITCOIN]: ProviderType.RPC,
};
