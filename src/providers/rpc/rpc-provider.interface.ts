import { BlockchainProvider, NetworkType } from '../blockchain/blockchain-provider.interface';

/**
 * RPC 提供者接口 - 擴展 BlockchainProvider 接口
 * 添加 RPC 特定的方法
 */
export interface RpcProvider extends BlockchainProvider {
  /**
   * 直接調用 RPC 方法
   * @param method RPC 方法名
   * @param params RPC 參數
   * @param networkType 網絡類型
   */
  callRpcMethod(method: string, params: any[], networkType?: NetworkType): Promise<any>;

  /**
   * 獲取 RPC 端點 URL
   * @param networkType 網絡類型
   */
  getRpcEndpoint(networkType?: NetworkType): string;

  /**
   * 檢查 RPC 連接健康狀態
   * @param networkType 網絡類型
   */
  checkHealth(networkType?: NetworkType): Promise<boolean>;
}
