import { Injectable } from '@nestjs/common';
import { AbstractProviderService } from './abstract-provider.service';
import {
  EvmProviderInterface,
  EthereumTransactionRequest,
} from '../interfaces/evm-provider.interface';
import {
  BalancesResponse,
  ChainConfig,
  NetworkType,
} from '../interfaces/blockchain-provider.interface';
import { isAddress, formatEther, parseEther } from 'ethers';
import { ChainName, EVM_CHAIN_INFO_MAP } from '../../chains/constants';

/**
 * EVM 區塊鏈提供者的抽象基類
 * 實現 EVM 提供者介面的共用功能
 */
@Injectable()
export abstract class AbstractEvmProviderService
  extends AbstractProviderService
  implements EvmProviderInterface
{
  /**
   * 支援的鏈類型列表
   */
  protected supportedChains: ChainName[] = [];

  /**
   * 初始化時設置支援的鏈類型列表
   * @param chains 支援的鏈類型
   */
  protected initSupportedChains(chains: ChainName[]): void {
    this.supportedChains = chains;
  }

  /**
   * 獲取 EVM 區塊鏈配置
   * @param chainName 鏈名稱
   */
  getChainConfig(chainName: ChainName): ChainConfig {
    const chainInfo = EVM_CHAIN_INFO_MAP[chainName];

    if (!chainInfo) {
      throw new Error(`Chain config not found for ${chainName}`);
    }

    // 獲取對應的測試網資訊
    const testnetChainInfo = Object.values(EVM_CHAIN_INFO_MAP).find(
      (info) => !info.isMainnet && info.mainnetRef === chainName,
    );

    return {
      chainId: chainInfo.id,
      name: chainInfo.display,
      nativeSymbol: chainInfo.symbol,
      nativeDecimals: chainInfo.decimals,
      testnetChainId: testnetChainInfo?.id,
      testnetName: testnetChainInfo?.display,
    };
  }

  /**
   * 檢查是否支援指定的鏈
   * @param chainName 鏈名稱
   */
  supportsChain(chainName: ChainName): boolean {
    return this.supportedChains.includes(chainName);
  }

  /**
   * 獲取特定地址的餘額資訊
   * 子類必須實現
   * @param address 區塊鏈地址
   * @param networkType 網絡類型
   * @param chainName 鏈名稱
   */
  abstract getBalances(
    address: string,
    networkType?: NetworkType,
    chainName?: ChainName,
  ): Promise<BalancesResponse>;

  /**
   * 獲取 Gas 價格
   * 子類必須實現
   * @param networkType 網絡類型
   * @param chainName 鏈名稱
   */
  abstract getGasPrice(networkType?: NetworkType, chainName?: ChainName): Promise<string>;

  /**
   * 估算交易所需 Gas 數量
   * 子類必須實現
   * @param txData 交易資料
   * @param networkType 網絡類型
   * @param chainName 鏈名稱
   */
  abstract estimateGas(
    txData: EthereumTransactionRequest,
    networkType?: NetworkType,
    chainName?: ChainName,
  ): Promise<string>;

  /**
   * 獲取 ERC20 Token 餘額
   * 子類必須實現
   * @param address 錢包地址
   * @param contractAddress 代幣合約地址
   * @param networkType 網絡類型
   * @param chainName 鏈名稱
   */
  abstract getErc20Balance(
    address: string,
    contractAddress: string,
    networkType?: NetworkType,
    chainName?: ChainName,
  ): Promise<string>;

  /**
   * 獲取 ERC721 NFT 資訊
   * 子類必須實現
   * @param address 錢包地址
   * @param contractAddress NFT 合約地址（可選）
   * @param networkType 網絡類型
   * @param chainName 鏈名稱
   */
  abstract getErc721Tokens(
    address: string,
    contractAddress?: string,
    networkType?: NetworkType,
    chainName?: ChainName,
  ): Promise<any[]>;

  /**
   * 驗證 EVM 地址有效性
   * 使用 ethers 的 isAddress 函數進行驗證
   * @param address 區塊鏈地址
   * @returns 地址是否有效
   */
  protected validateEvmAddress(address: string): boolean {
    return isAddress(address);
  }

  /**
   * 格式化 Wei 到 ETH 單位
   * 使用 ethers 的 formatEther 函數
   * @param weiAmount Wei 金額
   * @returns ETH 金額字串
   */
  protected weiToEth(weiAmount: string): string {
    return formatEther(weiAmount);
  }

  /**
   * 格式化 ETH 到 Wei 單位
   * 使用 ethers 的 parseEther 函數
   * @param ethAmount ETH 金額
   * @returns Wei 金額字串
   */
  protected ethToWei(ethAmount: string): string {
    return parseEther(ethAmount).toString();
  }
}
