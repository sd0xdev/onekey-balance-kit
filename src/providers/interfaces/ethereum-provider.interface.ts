import { BlockchainProviderInterface, NetworkType } from './blockchain-provider.interface';

/**
 * 以太坊交易資料結構
 */
export interface EthereumTransactionRequest {
  from: string;
  to?: string;
  value?: string | number;
  data?: string;
  nonce?: number;
  gasLimit?: string | number;
  gasPrice?: string | number;
  maxFeePerGas?: string | number;
  maxPriorityFeePerGas?: string | number;
  type?: number;
}

/**
 * 以太坊提供者介面
 * 擴展通用區塊鏈提供者介面
 */
export interface EthereumProviderInterface extends BlockchainProviderInterface {
  /**
   * 獲取以太坊 Gas 價格
   * @param networkType 網絡類型
   */
  getGasPrice(networkType?: NetworkType): Promise<string>;

  /**
   * 估算交易所需 Gas 數量
   * @param txData 交易資料
   * @param networkType 網絡類型
   */
  estimateGas(txData: EthereumTransactionRequest, networkType?: NetworkType): Promise<string>;

  /**
   * 獲取以太坊 ERC20 Token 餘額
   * @param address 錢包地址
   * @param contractAddress 代幣合約地址
   * @param networkType 網絡類型
   */
  getErc20Balance(
    address: string,
    contractAddress: string,
    networkType?: NetworkType,
  ): Promise<string>;

  /**
   * 獲取以太坊 ERC721 NFT 資訊
   * @param address 錢包地址
   * @param contractAddress NFT 合約地址
   * @param networkType 網絡類型
   */
  getErc721Tokens(
    address: string,
    contractAddress?: string,
    networkType?: NetworkType,
  ): Promise<any[]>;
}
