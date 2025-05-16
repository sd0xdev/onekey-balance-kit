import { BalancesResponse, NetworkType } from './blockchain-provider.interface';

/**
 * 區塊鏈服務提供者介面
 * 所有提供者服務類都應實現此介面
 */
export interface ProviderService {
  /**
   * 獲取提供者名稱
   */
  getProviderName(): string;

  /**
   * 獲取提供者是否可用
   */
  isSupported(): boolean;

  /**
   * 獲取特定地址的餘額資訊
   * @param address 區塊鏈地址
   * @param networkType 網絡類型
   */
  getBalances(address: string, networkType?: NetworkType): Promise<BalancesResponse>;

  /**
   * 取得服務的基礎 URL
   * @param networkType 網絡類型
   */
  getBaseUrl(networkType?: NetworkType): string;

  /**
   * 取得 API 金鑰
   * @param networkType 網絡類型
   */
  getApiKey(networkType?: NetworkType): string;
}
