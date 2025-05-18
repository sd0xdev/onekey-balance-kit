import { BalancesResponse } from '../interfaces/blockchain-provider.interface';

/**
 * 餘額適配器介面 - 將原始區塊鏈資料轉換為統一的 DTO 格式
 */
export interface BalanceAdapter {
  /**
   * 將原始餘額資料轉換為統一的 BalancesResponse
   * @param rawData 原始餘額資料
   * @returns 標準化的餘額響應
   */
  toBalancesResponse(rawData: any): BalancesResponse;

  /**
   * 將原始 Gas 價格資料轉換為統一的格式
   * @param rawData 原始 Gas 價格資料
   * @returns 標準化的 Gas 價格字串
   */
  toGasPrice(rawData: any): string;

  /**
   * 將原始 Gas 估算資料轉換為統一的格式
   * @param rawData 原始 Gas 估算資料
   * @returns 標準化的 Gas 估算字串
   */
  toEstimateGas(rawData: any): string;
}
