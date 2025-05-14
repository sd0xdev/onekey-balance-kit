export interface TokenMetadata {
  symbol?: string;
  decimals?: number;
  name?: string;
}

export interface NftMetadata {
  collection?: {
    name?: string;
  };
  name?: string;
  image?: string;
}

export interface TokenBalance {
  mint: string;
  tokenMetadata?: TokenMetadata;
  balance: string;
}

export interface NftBalance {
  mint: string;
  tokenId?: string;
  tokenMetadata?: NftMetadata;
}

export interface BalancesResponse {
  nativeBalance: {
    balance: string;
  };
  tokens: TokenBalance[];
  nfts: NftBalance[];
}

export enum NetworkType {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
}

export interface BlockchainProviderConfig {
  networkType: NetworkType;
  apiKeys?: Record<string, string>;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  nativeSymbol: string;
  nativeDecimals: number;
  testnetChainId?: number;
  testnetName?: string;
}

export interface BlockchainProvider {
  getBaseUrl(networkType?: NetworkType): string;
  getChainConfig(): ChainConfig;
  getApiKey(networkType?: NetworkType): string;
  getBalances(address: string, networkType?: NetworkType): Promise<BalancesResponse>;
  isSupported(): boolean;
}
