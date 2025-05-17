import { NetworkType } from '../interfaces/blockchain-provider.interface';

/**
 * 餘額策略介面 - 定義與區塊鏈節點通訊的方法
 */
export interface BalanceStrategy {
  /**
   * 獲取原始餘額資料
   * @param address 錢包地址
   * @param networkType 網路類型
   */
  getRawBalances(address: string, networkType: NetworkType): Promise<any>;

  /**
   * 獲取原始 Gas 價格資料
   * @param networkType 網路類型
   */
  getRawGasPrice(networkType: NetworkType): Promise<any>;

  /**
   * 估算交易所需 Gas
   * @param txData 交易資料
   * @param networkType 網路類型
   */
  getRawEstimateGas(txData: any, networkType: NetworkType): Promise<any>;
}
