import { BalanceAdapter } from '../balance-adapter.interface';
import { BalancesResponse } from '../../interfaces/blockchain-provider.interface';

/**
 * EVM QuickNode 適配器 - 將 QuickNode 原始資料轉換為統一格式
 */
export class EvmQuickNodeAdapter implements BalanceAdapter {
  /**
   * 將 QuickNode 原始餘額資料轉換為統一的 BalancesResponse
   * @param rawData QuickNode 原始餘額資料
   * @returns 標準化的餘額響應
   */
  toBalancesResponse(rawData: {
    nativeBalance: string;
    tokens: Array<{
      contractAddress: string;
      symbol: string;
      name: string;
      balance: string;
      decimals: number;
    }>;
    nfts: Array<any>;
  }): BalancesResponse {
    // 處理原生代幣餘額
    const nativeBalance = {
      balance: rawData.nativeBalance,
    };

    // 處理 ERC20 代幣
    const tokens = rawData.tokens.map((token) => ({
      mint: token.contractAddress,
      tokenMetadata: {
        symbol: token.symbol || 'UNKNOWN',
        decimals: token.decimals || 18,
        name: token.name || 'Unknown Token',
      },
      balance: token.balance || '0',
    }));

    // 處理 NFT
    const nfts = rawData.nfts.map((nft) => ({
      mint: nft.contractAddress,
      tokenId: nft.tokenId,
      tokenMetadata: {
        name: nft.name || 'Unknown NFT',
        image: nft.metadata?.image || '',
        collection: {
          name: nft.symbol || 'Unknown Collection',
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
   * 將 QuickNode 原始 Gas 價格資料轉換為統一格式
   * @param rawData 原始 Gas 價格資料
   * @returns 標準化的 Gas 價格字串
   */
  toGasPrice(rawData: { gasPrice?: string; maxFeePerGas?: string }): string {
    // 優先使用 EIP-1559 的 maxFeePerGas，如果不可用則使用傳統 gasPrice
    return rawData.maxFeePerGas || rawData.gasPrice || '0';
  }

  /**
   * 將 QuickNode 原始 Gas 估算資料轉換為統一格式
   * @param rawData 原始 Gas 估算資料
   * @returns 標準化的 Gas 估算字串
   */
  toEstimateGas(rawData: string): string {
    return rawData;
  }
}
