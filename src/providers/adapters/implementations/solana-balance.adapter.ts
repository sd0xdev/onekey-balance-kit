import { BalanceAdapter } from '../balance-adapter.interface';
import { BalancesResponse } from '../../interfaces/blockchain-provider.interface';

/**
 * Solana 鏈餘額適配器 - 將 Solana 原始資料轉換為統一格式
 */
export class SolanaBalanceAdapter implements BalanceAdapter {
  /**
   * 將 Solana 原始餘額資料轉換為統一的 BalancesResponse
   * @param rawData Solana 原始餘額資料，包含 SOL、SPL 代幣和 NFT
   * @returns 標準化的餘額響應
   */
  toBalancesResponse(rawData: {
    solBalance: string;
    tokenAccounts: Array<{
      mint: string;
      amount: string;
      decimals: number;
      uiAmount: number;
      symbol?: string;
      name?: string;
    }>;
    nfts: Array<{
      mint: string;
      name?: string;
      symbol?: string;
      image?: string;
      collectionName?: string;
      metadataUri?: string;
    }>;
  }): BalancesResponse {
    // 處理原生代幣 SOL 餘額
    const nativeBalance = {
      balance: rawData.solBalance,
    };

    // 處理 SPL 代幣
    const tokens = rawData.tokenAccounts.map((token) => ({
      mint: token.mint,
      tokenMetadata: {
        symbol: token.symbol || 'UNKNOWN',
        decimals: token.decimals || 9,
        name: token.name || 'Unknown Token',
      },
      balance: token.amount || '0',
    }));

    // 處理 NFT
    const nfts = rawData.nfts.map((nft) => ({
      mint: nft.mint,
      tokenId: nft.mint, // Solana 使用 mint 地址作為 tokenId
      tokenMetadata: {
        name: nft.name || 'Unknown NFT',
        image: nft.image || '',
        collection: {
          name: nft.collectionName || 'Unknown Collection',
        },
      },
    }));

    return {
      nativeBalance,
      tokens,
      nfts,
    };
  }

  /**
   * 將 Solana 原始 Gas 價格資料轉換為統一格式
   * @param rawData 原始 Gas 價格資料
   * @returns 標準化的 Gas 價格字串
   */
  toGasPrice(rawData: { lamportsPerSignature: number }): string {
    return rawData.lamportsPerSignature.toString();
  }

  /**
   * 將 Solana 原始 Gas 估算資料轉換為統一格式
   * @param rawData 原始 Gas 估算資料
   * @returns 標準化的 Gas 估算字串
   */
  toEstimateGas(rawData: { lamportsUsed: number }): string {
    return rawData.lamportsUsed.toString();
  }
}
