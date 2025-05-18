import { Injectable, Logger } from '@nestjs/common';
import { ChainService, ProviderAware } from '../../interfaces/chain-service.interface';
import { TokenBalance } from '../../interfaces/token-balance.interface';

/**
 * 抽象鏈服務基類
 * 定義所有鏈服務必須實現的基本功能
 */
@Injectable()
export abstract class AbstractChainService implements ChainService, ProviderAware {
  protected readonly logger = new Logger(this.constructor.name);
  private defaultProviderType?: string;

  /**
   * 檢查地址是否為有效地址
   */
  abstract isValidAddress(address: string): boolean;

  /**
   * 獲取地址的交易哈希
   */
  abstract getAddressTransactionHashes(address: string): Promise<string[]>;

  /**
   * 獲取交易的詳細信息
   */
  abstract getTransactionDetails(hash: string): Promise<any>;

  /**
   * 獲取鏈名稱
   */
  abstract getChainName(): string;

  /**
   * 獲取鏈代幣符號
   */
  abstract getChainSymbol(): string;

  /**
   * 設置預設提供者
   * @param providerType 提供者類型
   */
  setDefaultProvider(providerType: string): void {
    this.defaultProviderType = providerType;
    this.logInfo(`Default provider set to: ${providerType}`);
  }

  /**
   * 獲取預設提供者
   * @returns 預設提供者類型
   */
  getDefaultProvider(): string | undefined {
    return this.defaultProviderType;
  }

  /**
   * 日誌記錄輔助方法
   */
  protected logInfo(message: string): void {
    this.logger.log(`[${this.getChainName()}] ${message}`);
  }

  protected logError(message: string, trace?: string): void {
    this.logger.error(`[${this.getChainName()}] ${message}`, trace);
  }

  protected logWarn(message: string): void {
    this.logger.warn(`[${this.getChainName()}] ${message}`);
  }

  protected logDebug(message: string): void {
    this.logger.debug(`[${this.getChainName()}] ${message}`);
  }

  /**
   * 獲取用戶在指定地址的代幣餘額
   * @param address 用戶地址
   * @param chainId 可選的鏈ID，如未指定則使用當前設定的鏈ID
   * @param providerType 可選的提供者類型
   * @returns 代幣餘額資訊
   */
  abstract getBalances(address: string, chainId?: number, providerType?: string): Promise<any>;

  /**
   * 驗證地址是否有效
   * @param address 要驗證的地址
   * @returns 地址是否有效
   */
  abstract validateAddress(address: string): boolean;
}
