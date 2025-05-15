import { Injectable } from '@nestjs/common';
import { AbstractProviderService } from './abstract-provider.service';
import {
  SolanaProviderInterface,
  SolanaTransactionRequest,
} from '../interfaces/solana-provider.interface';
import {
  BalancesResponse,
  ChainConfig,
  NetworkType,
} from '../interfaces/blockchain-provider.interface';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

/**
 * Solana 區塊鏈提供者的抽象基類
 * 實現 Solana 提供者介面的共用功能
 */
@Injectable()
export abstract class AbstractSolanaProviderService
  extends AbstractProviderService
  implements SolanaProviderInterface
{
  /**
   * 獲取 Solana 區塊鏈配置
   */
  getChainConfig(): ChainConfig {
    return {
      chainId: 101, // Solana mainnet
      name: 'Solana',
      nativeSymbol: 'SOL',
      nativeDecimals: 9,
      testnetChainId: 103, // Solana devnet
      testnetName: 'Devnet',
    };
  }

  /**
   * 獲取特定地址的餘額資訊
   * 子類必須實現
   * @param address Solana 地址
   * @param networkType 網絡類型
   */
  abstract getBalances(address: string, networkType?: NetworkType): Promise<BalancesResponse>;

  /**
   * 獲取 Solana 近期區塊雜湊值
   * 子類必須實現
   * @param networkType 網絡類型
   */
  abstract getRecentBlockhash(networkType?: NetworkType): Promise<string>;

  /**
   * 獲取 SPL Token 餘額
   * 子類必須實現
   * @param address 錢包地址
   * @param mintAddress 代幣鑄造地址
   * @param networkType 網絡類型
   */
  abstract getSplTokenBalance(
    address: string,
    mintAddress: string,
    networkType?: NetworkType,
  ): Promise<string>;

  /**
   * 獲取 Solana NFT 資訊 (包括 Metaplex 標準)
   * 子類必須實現
   * @param address 錢包地址
   * @param collection 集合地址 (可選)
   * @param networkType 網絡類型
   */
  abstract getNfts(address: string, collection?: string, networkType?: NetworkType): Promise<any[]>;

  /**
   * 獲取 Solana 帳戶資訊
   * 子類必須實現
   * @param address 帳戶地址
   * @param networkType 網絡類型
   */
  abstract getAccountInfo(address: string, networkType?: NetworkType): Promise<any>;

  /**
   * 驗證 Solana 地址有效性
   * 使用 @solana/web3.js 的 PublicKey 來驗證
   * @param address Solana 地址
   * @returns 地址是否有效
   */
  protected validateSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 格式化 Lamports 到 SOL
   * 使用 @solana/web3.js 的 LAMPORTS_PER_SOL 常數
   * @param lamports Lamports 金額
   * @returns SOL 金額字串
   */
  protected lamportsToSol(lamports: string): string {
    return (Number(lamports) / LAMPORTS_PER_SOL).toString();
  }

  /**
   * 格式化 SOL 到 Lamports
   * 使用 @solana/web3.js 的 LAMPORTS_PER_SOL 常數
   * @param sol SOL 金額
   * @returns Lamports 金額字串
   */
  protected solToLamports(sol: string): string {
    return (Number(sol) * LAMPORTS_PER_SOL).toString();
  }
}
