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
}
