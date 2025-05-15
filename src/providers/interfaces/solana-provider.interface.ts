import { BlockchainProviderInterface, NetworkType } from './blockchain-provider.interface';

/**
 * Solana 交易資料結構
 */
export interface SolanaTransactionRequest {
  feePayer: string;
  recentBlockhash?: string;
  instructions: any[];
}

/**
 * Solana 提供者介面
 * 擴展通用區塊鏈提供者介面
 */
export interface SolanaProviderInterface extends BlockchainProviderInterface {
  /**
   * 獲取 Solana 近期區塊雜湊值
   * @param networkType 網絡類型
   */
  getRecentBlockhash(networkType?: NetworkType): Promise<string>;

  /**
   * 獲取 SPL Token 餘額
   * @param address 錢包地址
   * @param mintAddress 代幣鑄造地址
   * @param networkType 網絡類型
   */
  getSplTokenBalance(
    address: string,
    mintAddress: string,
    networkType?: NetworkType,
  ): Promise<string>;

  /**
   * 獲取 Solana NFT 資訊 (包括 Metaplex 標準)
   * @param address 錢包地址
   * @param collection 集合地址 (可選)
   * @param networkType 網絡類型
   */
  getNfts(address: string, collection?: string, networkType?: NetworkType): Promise<any[]>;

  /**
   * 獲取 Solana 帳戶資訊
   * @param address 帳戶地址
   * @param networkType 網絡類型
   */
  getAccountInfo(address: string, networkType?: NetworkType): Promise<any>;
}
