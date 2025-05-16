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
 * 可查詢餘額的介面
 * 這個介面可以與 ChainService 介面組合使用
 */
export interface BalanceQueryable {
  /**
   * 獲取特定地址的餘額資訊
   * @param address 區塊鏈地址
   * @param chainId 可選的鏈ID，如未指定則使用當前設定的鏈ID
   * @param providerType 指定使用的提供者類型，默認使用配置中的默認提供者
   * @returns 包含餘額信息的對象
   */
  getBalances(address: string, chainId?: number, providerType?: string): Promise<BalanceResponse>;
}

/**
 * 檢查服務是否實現了 BalanceQueryable 介面的類型守衛函數
 * @param service 要檢查的服務
 * @returns 服務是否實現了 BalanceQueryable 介面
 */
export function isBalanceQueryable(service: any): service is BalanceQueryable {
  return 'getBalances' in service && typeof service.getBalances === 'function';
}
