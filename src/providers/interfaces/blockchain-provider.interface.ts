import { ProviderInterface } from './provider.interface';

export enum NetworkType {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
}

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
  isSuccess?: boolean;
  errorMessage?: string;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  nativeSymbol: string;
  nativeDecimals: number;
  testnetChainId?: number;
  testnetName?: string;
}

/**
 * 區塊鏈提供者通用介面，擴展基本提供者介面
 */
export interface BlockchainProviderInterface extends ProviderInterface {
  /**
   * 獲取區塊鏈配置
   */
  getChainConfig(): ChainConfig;

  /**
   * 獲取帳戶餘額資訊
   * @param address 區塊鏈地址
   * @param networkType 網絡類型
   */
  getBalances(address: string, networkType?: NetworkType): Promise<BalancesResponse>;
}
