import { Injectable, Logger } from '@nestjs/common';
import { ProviderInterface } from '../interfaces/provider.interface';

/**
 * 抽象基礎提供者服務類
 * 提供基礎日誌功能和共用方法
 */
@Injectable()
export abstract class AbstractProviderService implements ProviderInterface {
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * 獲取提供者名稱的抽象方法
   * 子類必須實現
   */
  abstract getProviderName(): string;

  /**
   * 檢查提供者是否支援的抽象方法
   * 子類必須實現
   */
  abstract isSupported(): boolean;

  /**
   * 獲取特定網絡的基礎 URL 的抽象方法
   * 子類必須實現
   * @param networkType 網絡類型
   */
  abstract getBaseUrl(networkType?: string): string;

  /**
   * 獲取提供者的 API 密鑰的抽象方法
   * 子類必須實現
   * @param networkType 網絡類型
   */
  abstract getApiKey(networkType?: string): string;

  /**
   * 記錄信息日誌
   * @param message 日誌信息
   */
  protected logInfo(message: string): void {
    this.logger.log(message);
  }

  /**
   * 記錄錯誤日誌
   * @param message 錯誤信息
   */
  protected logError(message: string): void {
    this.logger.error(message);
  }

  /**
   * 記錄警告日誌
   * @param message 警告信息
   */
  protected logWarning(message: string): void {
    this.logger.warn(message);
  }

  /**
   * 記錄調試日誌
   * @param message 調試信息
   */
  protected logDebug(message: string): void {
    this.logger.debug(message);
  }
}
