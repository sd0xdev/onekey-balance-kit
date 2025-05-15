import { Injectable, Logger } from '@nestjs/common';
import { ChainService } from '../interfaces/chain-service.interface';

@Injectable()
export abstract class AbstractChainService implements ChainService {
  protected readonly logger = new Logger(this.constructor.name);

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
}
