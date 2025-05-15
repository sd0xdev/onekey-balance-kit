/**
 * 餘額響應通用介面
 * 具體鏈的餘額響應會擴展這個介面
 */
export interface BalanceResponse {
  nativeBalance: {
    symbol: string;
    decimals: number;
    balance: string;
    usd?: number;
  };
  tokens?: any[];
  nfts?: any[];
  updatedAt: number;
  [key: string]: any; // 允許額外屬性
}

/**
 * 可獲取餘額的鏈服務介面
 * 這個介面可以與 ChainService 介面組合使用
 */
export interface BalanceableChainService {
  /**
   * 獲取特定地址的餘額資訊
   * @param address 區塊鏈地址
   * @param useTestnet 是否使用測試網絡，默認為 false
   * @returns 包含餘額信息的對象
   */
  getBalances(address: string, useTestnet?: boolean): Promise<BalanceResponse>;
}
