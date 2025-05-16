import { HttpException } from '@nestjs/common';
import { ErrorCode, getErrorDetails } from '../constants/error-codes';

/**
 * 應用錯誤異常類
 *
 * 提供了一種統一的方式來創建帶有錯誤代碼的HTTP異常
 */
export class ApplicationException extends HttpException {
  /**
   * 創建一個應用異常
   * @param errorCode 錯誤代碼
   * @param details 詳細錯誤信息 (可選)
   * @param customMessage 自定義錯誤信息 (可選，覆蓋默認錯誤信息)
   */
  constructor(
    public readonly errorCode: ErrorCode,
    public readonly details?: string,
    customMessage?: string,
  ) {
    const errorDetails = getErrorDetails(errorCode);
    const isProduction = process.env.NODE_ENV === 'production';

    // 準備響應數據 - 在生產環境中移除敏感信息
    const response: Record<string, any> = {
      error: errorCode,
      message: customMessage || errorDetails.message,
    };

    // 只在非生產環境中添加詳細錯誤信息
    if (details && !isProduction) {
      response.details = details;
    }

    super(response, errorDetails.httpStatus);
  }
}

/**
 * 區塊鏈相關異常
 */
export class BlockchainException extends ApplicationException {
  constructor(errorCode: ErrorCode, details?: string, customMessage?: string) {
    super(errorCode, details, customMessage);
  }
}

/**
 * 提供者相關異常
 */
export class ProviderException extends ApplicationException {
  constructor(errorCode: ErrorCode, details?: string, customMessage?: string) {
    super(errorCode, details, customMessage);
  }
}

/**
 * 餘額相關異常
 */
export class BalanceException extends ApplicationException {
  constructor(errorCode: ErrorCode, details?: string, customMessage?: string) {
    super(errorCode, details, customMessage);
  }
}
