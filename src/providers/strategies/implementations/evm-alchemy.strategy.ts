import { Alchemy, TokenBalanceType } from 'alchemy-sdk';
import { BalanceStrategy } from '../balance-strategy.interface';
import { NetworkType } from '../../interfaces/blockchain-provider.interface';
import { EthereumTransactionRequest } from '../../interfaces/evm-provider.interface';

/**
 * EVM Alchemy 策略 - 處理與 EVM 鏈上 Alchemy 節點的通訊
 */
export class EvmAlchemyStrategy implements BalanceStrategy {
  /**
   * 建構子
   * @param client Alchemy SDK 客戶端
   */
  constructor(private readonly client: Alchemy) {}

  /**
   * 獲取原始餘額資料
   * @param address 錢包地址
   * @param networkType 網路類型
   */
  async getRawBalances(address: string, networkType: NetworkType): Promise<any> {
    // 獲取原生代幣餘額
    const nativeBalance = await this.client.core.getBalance(address);

    // 獲取 ERC20 代幣餘額
    const tokenBalancesResponse = await this.client.core.getTokenBalances(address, {
      type: TokenBalanceType.ERC20,
    });

    // 獲取代幣元數據
    const tokenMetadataPromises = tokenBalancesResponse.tokenBalances.map((token) =>
      this.client.core.getTokenMetadata(token.contractAddress),
    );

    const tokenMetadataResults = await Promise.all(tokenMetadataPromises);

    // 組合代幣資訊
    const tokenBalances = tokenBalancesResponse.tokenBalances.map((token, index) => {
      const metadata = tokenMetadataResults[index];
      return {
        contractAddress: token.contractAddress,
        tokenBalance: token.tokenBalance || '0',
        tokenMetadata: {
          symbol: metadata?.symbol || 'UNKNOWN',
          decimals: metadata?.decimals || 18,
          name: metadata?.name || 'Unknown Token',
        },
      };
    });

    // 獲取 NFT
    const nftsResponse = await this.client.nft.getNftsForOwner(address);

    return {
      nativeBalance: nativeBalance.toString(),
      tokenBalances,
      ownedNfts: nftsResponse.ownedNfts,
    };
  }

  /**
   * 獲取原始 Gas 價格資料
   * @param networkType 網路類型
   */
  async getRawGasPrice(networkType: NetworkType): Promise<any> {
    const feeData = await this.client.core.getFeeData();

    return {
      gasPrice: feeData.gasPrice?.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
    };
  }

  /**
   * 估算交易所需 Gas
   * @param txData 交易資料
   * @param networkType 網路類型
   */
  async getRawEstimateGas(
    txData: EthereumTransactionRequest,
    networkType: NetworkType,
  ): Promise<any> {
    const estimatedGas = await this.client.core.estimateGas({
      from: txData.from,
      to: txData.to,
      data: txData.data,
      value: txData.value,
    });

    return estimatedGas.toString();
  }
}
