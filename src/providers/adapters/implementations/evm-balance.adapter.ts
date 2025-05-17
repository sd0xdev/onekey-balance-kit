import { BalanceAdapter } from '../balance-adapter.interface';
import { BalancesResponse } from '../../interfaces/blockchain-provider.interface';
import { formatUnits } from 'ethers';

/**
 * EVM 鏈餘額適配器 - 將 EVM 原始資料轉換為統一格式
 */
export class EvmBalanceAdapter implements BalanceAdapter {
  /**
   * 將 EVM 原始餘額資料轉換為統一的 BalancesResponse
   * @param rawData EVM 原始餘額資料，包含原生代幣、ERC20 代幣和 NFT
   * @returns 標準化的餘額響應
   */
  toBalancesResponse(rawData: {
    nativeBalance: string;
    tokenBalances: Array<{ contractAddress: string; tokenBalance: string; tokenMetadata: any }>;
    ownedNfts: Array<any>;
  }): BalancesResponse {
    // 處理原生代幣餘額
    const nativeBalance = {
      balance: rawData.nativeBalance,
    };

    // 處理 ERC20 代幣
    const tokens = rawData.tokenBalances.map((token) => ({
      mint: token.contractAddress,
      tokenMetadata: {
        symbol: token.tokenMetadata?.symbol || 'UNKNOWN',
        decimals: token.tokenMetadata?.decimals || 18,
        name: token.tokenMetadata?.name || 'Unknown Token',
      },
      balance: token.tokenBalance || '0',
    }));

    // 處理 NFT
    const nfts = rawData.ownedNfts.map((nft) => {
      // 獲取圖片 URL
      let imageUrl = '';
      if (nft.raw?.metadata?.image) {
        imageUrl = nft.raw.metadata.image;
      }

      return {
        mint: nft.contract.address,
        tokenId: nft.tokenId,
        tokenMetadata: {
          name: nft.raw?.metadata?.name || nft.contract.name || 'Unknown NFT',
          image: imageUrl,
          collection: {
            name: nft.contract.name || 'Unknown Collection',
          },
        },
      };
    });

    return {
      nativeBalance,
      tokens,
      nfts,
    };
  }

  /**
   * 將 EVM 原始 Gas 價格資料轉換為統一格式
   * @param rawData 原始 Gas 價格資料
   * @returns 標準化的 Gas 價格字串
   */
  toGasPrice(rawData: { gasPrice?: string; maxFeePerGas?: string }): string {
    // 優先使用 EIP-1559 的 maxFeePerGas，如果不可用則使用傳統 gasPrice
    return rawData.maxFeePerGas || rawData.gasPrice || '0';
  }

  /**
   * 將 EVM 原始 Gas 估算資料轉換為統一格式
   * @param rawData 原始 Gas 估算資料
   * @returns 標準化的 Gas 估算字串
   */
  toEstimateGas(rawData: string): string {
    return rawData;
  }
}
