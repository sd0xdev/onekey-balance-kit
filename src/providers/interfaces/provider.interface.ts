/**
 * 基礎提供者服務介面
 * 所有區塊鏈資料提供者需實現此介面
 */
export interface ProviderInterface {
  /**
   * 獲取提供者名稱
   */
  getProviderName(): string;

  /**
   * 檢查提供者是否可用
   */
  isSupported(): boolean;

  /**
   * 獲取提供者的 API 金鑰
   * @param networkType 網絡類型 (mainnet/testnet)
   */
  getApiKey(networkType?: string): string;

  /**
   * 獲取提供者的基礎 URL
   * @param networkType 網絡類型 (mainnet/testnet)
   */
  getBaseUrl(networkType?: string): string;
}
