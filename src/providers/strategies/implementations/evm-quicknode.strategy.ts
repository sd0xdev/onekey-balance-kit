import { Core } from '@quicknode/sdk';
import { BalanceStrategy } from '../balance-strategy.interface';
import { NetworkType } from '../../interfaces/blockchain-provider.interface';
import { EthereumTransactionRequest } from '../../interfaces/ethereum-provider.interface';

/**
 * EVM QuickNode 策略 - 使用 QuickNode SDK 與節點通訊
 */
export class EvmQuickNodeStrategy implements BalanceStrategy {
  /**
   * 建構函數
   * @param mainnetClient QuickNode 主網客戶端
   * @param testnetClient QuickNode 測試網客戶端
   */
  constructor(
    private readonly mainnetClient: Core | null = null,
    private readonly testnetClient: Core | null = null,
  ) {}

  /**
   * 獲取 QuickNode 客戶端實例
   * @param networkType 網路類型
   * @returns 對應的 QuickNode 客戶端
   */
  private getClient(networkType: NetworkType): Core {
    const client =
      networkType === NetworkType.TESTNET
        ? this.testnetClient || this.mainnetClient
        : this.mainnetClient;

    if (!client) {
      throw new Error('QuickNode client not initialized');
    }

    return client;
  }

  /**
   * 將地址轉換為十六進制格式
   * @param address 地址
   * @returns 十六進制格式地址
   */
  private ensureHexAddress(address?: string): `0x${string}` {
    if (!address) {
      return '0x0000000000000000000000000000000000000000';
    }

    const normalizedAddress = address.toLowerCase();

    if (!normalizedAddress.startsWith('0x')) {
      return `0x${normalizedAddress}`;
    }

    return normalizedAddress as `0x${string}`;
  }

  /**
   * 獲取地址的原始餘額資料
   * @param address 地址
   * @param networkType 網路類型
   * @returns 包含原生代幣、代幣和 NFT 的原始資料
   */
  async getRawBalances(address: string, networkType: NetworkType): Promise<any> {
    const client = this.getClient(networkType);
    const ethAddress = this.ensureHexAddress(address);

    // 獲取原生代幣餘額
    const nativeBalanceResult = await client.client.getBalance({
      address: ethAddress,
    });
    const nativeBalance = nativeBalanceResult.toString();

    // 獲取代幣列表
    let tokens: any[] = [];
    let nfts: any[] = [];

    try {
      const clientAny = client.client as any;

      // 嘗試使用 QuickNode Token API
      if (typeof clientAny.qn_fetchTokenBalances === 'function') {
        const tokenBalancesResponse = await clientAny.qn_fetchTokenBalances({
          wallet: address,
          contracts: [],
          perPage: 100,
        });

        if (tokenBalancesResponse && Array.isArray(tokenBalancesResponse.tokens)) {
          tokens = tokenBalancesResponse.tokens.map((token: any) => ({
            contractAddress: token.address,
            symbol: token.symbol || '',
            name: token.name || token.symbol || '',
            balance: token.amount || '0',
            decimals: token.decimals || 18,
          }));
        }
      }

      // 嘗試使用 QuickNode NFT API
      if (typeof clientAny.qn_fetchNFTs === 'function') {
        const nftsResponse = await clientAny.qn_fetchNFTs({
          wallet: address,
          perPage: 100,
          page: 1,
        });

        if (nftsResponse && Array.isArray(nftsResponse.assets)) {
          nfts = nftsResponse.assets.map((nft: any) => ({
            contractAddress: nft.collectionAddress,
            tokenId: nft.tokenId,
            name: nft.name || '',
            symbol: nft.collectionName || '',
            tokenURI: nft.imageUrl || '',
            standard: nft.collectionTokenType || 'ERC721',
            metadata: {
              image: nft.imageUrl || '',
              attributes: nft.traits || [],
            },
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching token or NFT data:', error);
      // 記錄錯誤但繼續處理，因為這些是非關鍵資料
    }

    // 返回原始資料結構
    return {
      nativeBalance,
      tokens,
      nfts,
    };
  }

  /**
   * 獲取原始 Gas 價格資料
   * @param networkType 網路類型
   * @returns Gas 價格相關資訊
   */
  async getRawGasPrice(networkType: NetworkType): Promise<any> {
    const client = this.getClient(networkType);

    try {
      // 由於 QuickNode SDK 沒有 getFeeData 方法，使用基本的 getGasPrice
      const gasPrice = await client.client.getGasPrice();

      // 試著獲取 maxPriorityFeePerGas 通過 RPC 調用
      let maxPriorityFeePerGas = '0';
      let maxFeePerGas = '0';

      try {
        const clientAny = client.client as any;
        if (typeof clientAny.send === 'function') {
          // 嘗試使用 eth_maxPriorityFeePerGas RPC 方法
          const priorityFeeResult = await clientAny.send('eth_maxPriorityFeePerGas', []);
          if (priorityFeeResult) {
            maxPriorityFeePerGas = BigInt(priorityFeeResult).toString();
            // 計算 maxFeePerGas = gasPrice + maxPriorityFeePerGas
            maxFeePerGas = (BigInt(gasPrice.toString()) + BigInt(maxPriorityFeePerGas)).toString();
          } else {
            // 如果沒有取得值，使用 gasPrice 作為 maxFeePerGas
            maxFeePerGas = gasPrice.toString();
          }
        }
      } catch (error) {
        console.error('Failed to get priority fee:', error);
        maxFeePerGas = gasPrice.toString();
      }

      return {
        gasPrice: gasPrice.toString(),
        maxFeePerGas,
        maxPriorityFeePerGas,
      };
    } catch (error) {
      console.error('Error getting gas price:', error);

      // 如果方法失敗，返回預設值
      return {
        gasPrice: '0',
        maxFeePerGas: '0',
        maxPriorityFeePerGas: '0',
      };
    }
  }

  /**
   * 估算交易的 Gas 用量
   * @param txData 交易資料
   * @param networkType 網路類型
   * @returns 估算的 Gas 用量
   */
  async getRawEstimateGas(
    txData: EthereumTransactionRequest,
    networkType: NetworkType,
  ): Promise<any> {
    const client = this.getClient(networkType);

    try {
      // 構建估算 Gas 的請求 (適配 QuickNode SDK 的請求格式)
      const from = this.ensureHexAddress(txData.from);
      const to = txData.to ? this.ensureHexAddress(txData.to) : null;

      // 修改 estimateGas 的調用，使用 RPC 方法直接調用
      const clientAny = client.client as any;
      let gasEstimate;

      if (typeof clientAny.send === 'function') {
        // 使用原始 RPC 方法調用 eth_estimateGas
        const params: any = {
          from: from,
          to: to,
        };

        if (txData.data) {
          params.data = txData.data;
        }

        if (txData.value) {
          params.value =
            typeof txData.value === 'string' && txData.value.startsWith('0x')
              ? txData.value
              : `0x${BigInt(txData.value).toString(16)}`;
        }

        gasEstimate = await clientAny.send('eth_estimateGas', [params]);
        gasEstimate = BigInt(gasEstimate).toString();
      } else {
        // 使用官方 API (假設格式適配)
        gasEstimate = await client.client.estimateGas({
          to: to ?? undefined,
          data: txData.data as `0x${string}` | undefined,
          value: txData.value ? BigInt(txData.value) : undefined,
        });
        gasEstimate = gasEstimate.toString();
      }

      return gasEstimate.toString();
    } catch (error) {
      console.error('Error estimating gas:', error);
      throw new Error(`Failed to estimate gas: ${error}`);
    }
  }
}
