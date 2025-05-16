import { Injectable } from '@nestjs/common';
import { AbstractEvmProviderService } from './abstract-evm-provider.service';
import {
  EthereumProviderInterface,
  EthereumTransactionRequest,
} from '../interfaces/ethereum-provider.interface';
import {
  BalancesResponse,
  ChainConfig,
  NetworkType,
} from '../interfaces/blockchain-provider.interface';
import { ChainName } from '../../chains/constants';

/**
 * 以太坊區塊鏈提供者的抽象基類 (向後兼容)
 * 實現以太坊提供者介面的共用功能
 * 現在繼承自 AbstractEvmProviderService 以重用邏輯
 */
@Injectable()
export abstract class AbstractEthereumProviderService
  extends AbstractEvmProviderService
  implements EthereumProviderInterface
{
  /**
   * 獲取以太坊區塊鏈配置
   * 轉發到父類的 getChainConfig
   */
  getChainConfig(): ChainConfig {
    return super.getChainConfig(ChainName.ETHEREUM);
  }

  /**
   * 獲取特定地址的餘額資訊
   * 子類必須實現
   * @param address 以太坊地址
   * @param networkType 網絡類型
   */
  abstract getBalances(address: string, networkType?: NetworkType): Promise<BalancesResponse>;

  /**
   * 獲取以太坊 Gas 價格
   * 子類必須實現
   * @param networkType 網絡類型
   */
  abstract getGasPrice(networkType?: NetworkType): Promise<string>;

  /**
   * 估算交易所需 Gas 數量
   * 子類必須實現
   * @param txData 交易資料
   * @param networkType 網絡類型
   */
  abstract estimateGas(
    txData: EthereumTransactionRequest,
    networkType?: NetworkType,
  ): Promise<string>;

  /**
   * 獲取以太坊 ERC20 Token 餘額
   * 子類必須實現
   * @param address 錢包地址
   * @param contractAddress 代幣合約地址
   * @param networkType 網絡類型
   */
  abstract getErc20Balance(
    address: string,
    contractAddress: string,
    networkType?: NetworkType,
  ): Promise<string>;

  /**
   * 獲取以太坊 ERC721 NFT 資訊
   * 子類必須實現
   * @param address 錢包地址
   * @param contractAddress NFT 合約地址（可選）
   * @param networkType 網絡類型
   */
  abstract getErc721Tokens(
    address: string,
    contractAddress?: string,
    networkType?: NetworkType,
  ): Promise<any[]>;

  /**
   * 驗證以太坊地址有效性
   * 使用父類的 validateEvmAddress
   * @param address 以太坊地址
   * @returns 地址是否有效
   */
  protected validateEthereumAddress(address: string): boolean {
    return this.validateEvmAddress(address);
  }
}
