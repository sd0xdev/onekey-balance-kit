import {
  BlockchainProviderInterface,
  BalancesResponse,
  NetworkType,
  ChainConfig,
} from './blockchain-provider.interface';
import { ChainName } from '../../chains/constants';

/**
 * EVM 交易請求介面
 * 兼容 Ethereum 交易請求格式
 */
export interface EthereumTransactionRequest {
  from: string;
  to?: string;
  data?: string;
  value?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

/**
 * EVM 提供者介面
 * 定義通用的 EVM 鏈服務方法
 */
export interface EvmProviderInterface extends BlockchainProviderInterface {
  /**
   * 獲取區塊鏈配置
   * @param chainName 鏈名稱
   */
  getChainConfig(chainName?: ChainName): ChainConfig;

  /**
   * 獲取 Gas 價格
   * @param networkType 網絡類型
   * @param chainName 鏈名稱 (可選)
   */
  getGasPrice(networkType?: NetworkType, chainName?: ChainName): Promise<string>;

  /**
   * 估算交易所需 Gas
   * @param txData 交易數據
   * @param networkType 網絡類型
   * @param chainName 鏈名稱 (可選)
   */
  estimateGas(
    txData: EthereumTransactionRequest,
    networkType?: NetworkType,
    chainName?: ChainName,
  ): Promise<string>;

  /**
   * 獲取 ERC20 Token 餘額
   * @param address 錢包地址
   * @param contractAddress ERC20 合約地址
   * @param networkType 網絡類型
   * @param chainName 鏈名稱 (可選)
   */
  getErc20Balance(
    address: string,
    contractAddress: string,
    networkType?: NetworkType,
    chainName?: ChainName,
  ): Promise<string>;

  /**
   * 獲取 ERC721 Token (NFT) 資訊
   * @param address 錢包地址
   * @param contractAddress ERC721 合約地址 (可選)
   * @param networkType 網絡類型
   * @param chainName 鏈名稱 (可選)
   */
  getErc721Tokens(
    address: string,
    contractAddress?: string,
    networkType?: NetworkType,
    chainName?: ChainName,
  ): Promise<any[]>;

  /**
   * 檢查提供者是否支援特定鏈
   * @param chainName 鏈名稱
   */
  supportsChain(chainName: ChainName): boolean;

  /**
   * 獲取特定地址的餘額資訊
   * @param address 錢包地址
   * @param networkType 網絡類型
   * @param chainName 鏈名稱 (可選)
   */
  getBalances(
    address: string,
    networkType?: NetworkType,
    chainName?: ChainName,
  ): Promise<BalancesResponse>;
}

/**
 * 保持與現有代碼的兼容性
 * EthereumProviderInterface 現在是 EvmProviderInterface 的別名
 */
export type EthereumProviderInterface = EvmProviderInterface;
