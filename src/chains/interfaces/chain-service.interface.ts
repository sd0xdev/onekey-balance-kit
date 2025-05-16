/**
 * 泛型交易類型，應用於不同鏈的交易
 */
export type Transaction = any;

/**
 * 泛型私鑰類型
 */
export type PrivateKey = string;

/**
 * 交易結果類型
 */
export type TransactionResult = string;

/**
 * 餘額響應類型
 */
export type BalanceResponse = Array<{
  symbol: string;
  balance: string;
  tokenAddress: string | null;
}>;

/**
 * 提供者感知介面
 * 實現此介面的服務可以設置和獲取預設提供者
 */
export interface ProviderAware {
  /**
   * 設置預設提供者
   * @param providerType 提供者類型
   */
  setDefaultProvider(providerType: string): void;

  /**
   * 獲取預設提供者
   * @returns 預設提供者類型
   */
  getDefaultProvider(): string | undefined;
}

/**
 * 區塊鏈服務介面
 * 所有鏈服務類都應實現此介面
 */
export interface ChainService {
  /**
   * 檢查地址是否為有效地址
   */
  isValidAddress(address: string): boolean;

  /**
   * 獲取地址的交易哈希
   */
  getAddressTransactionHashes(address: string): Promise<string[]>;

  /**
   * 獲取交易的詳細信息
   */
  getTransactionDetails(hash: string): Promise<any>;

  /**
   * 獲取鏈名稱
   */
  getChainName(): string;

  /**
   * 獲取鏈的代幣符號
   */
  getChainSymbol(): string;

  /**
   * 獲取地址的餘額（包括主幣和代幣）
   * 此方法是可選的，不是所有鏈服務都必須實現
   */
  getBalances?(address: string, chainId?: number): Promise<BalanceResponse>;
}
