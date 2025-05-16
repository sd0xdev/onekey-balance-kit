import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode, getErrorCodeFromStatus, getErrorDetails } from '../constants/error-codes';

/**
 * 全局HTTP異常過濾器
 * 將所有異常轉換為對客戶端友好的錯誤回應
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 預設狀態碼和錯誤訊息
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '伺服器發生錯誤';
    let errorCode = ErrorCode.COMMON_INTERNAL_ERROR;
    let details: string | null = null;

    // 處理 HTTP 異常
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        errorCode = (exceptionResponse as any).error || getErrorCodeFromStatus(status);
        details = (exceptionResponse as any).details || null;
      } else {
        message = exception.message;
        errorCode = getErrorCodeFromStatus(status);
      }
    }
    // 處理特定的錯誤模式
    else if (exception instanceof Error) {
      // 處理認證相關錯誤
      if (
        exception.message.includes('401 Unauthorized') ||
        exception.message.includes('Must be authenticated')
      ) {
        status = HttpStatus.UNAUTHORIZED;
        errorCode = ErrorCode.PROVIDER_AUTH_FAILED;
        message = getErrorDetails(errorCode).message;
        details = '請確認API金鑰是否正確設置';
      }
      // 處理無效地址錯誤
      else if (exception.message.includes('Invalid') && exception.message.includes('address')) {
        status = HttpStatus.BAD_REQUEST;
        errorCode = ErrorCode.BLOCKCHAIN_INVALID_ADDRESS;
        message = getErrorDetails(errorCode).message;
      }
      // 處理提供者不可用錯誤
      else if (exception.message.includes('無法獲取餘額')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        errorCode = ErrorCode.BALANCE_FETCH_FAILED;
        message = getErrorDetails(errorCode).message;
        details = exception.message.split('無法獲取餘額:')[1]?.trim() || null;
      }
      // 處理區塊鏈不支持錯誤
      else if (exception.message.includes('Chain') && exception.message.includes('not supported')) {
        status = HttpStatus.BAD_REQUEST;
        errorCode = ErrorCode.BLOCKCHAIN_INVALID_CHAIN;
        message = getErrorDetails(errorCode).message;
      }
      // 處理提供者不支持錯誤
      else if (exception.message.includes('沒有找到區塊鏈類型')) {
        status = HttpStatus.NOT_IMPLEMENTED;
        errorCode = ErrorCode.PROVIDER_NOT_SUPPORTED;
        message = getErrorDetails(errorCode).message;
        details = exception.message;
      }
      // 其他一般錯誤
      else {
        message = exception.message;
        errorCode = ErrorCode.COMMON_INTERNAL_ERROR;
        this.logger.error(`未分類的錯誤: ${exception.message}`, exception.stack);
      }
    }

    // 構建錯誤響應
    const errorResponse = {
      statusCode: status,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // 環境判斷 - 生產環境將進一步限制暴露的信息
    const isProduction = process.env.NODE_ENV === 'production';

    // 在非生產環境才添加詳細錯誤信息
    if (details && !isProduction) {
      errorResponse['details'] = details;
    }

    // 在生產環境中根據錯誤代碼的公開程度處理錯誤訊息
    if (isProduction) {
      // 獲取錯誤代碼的詳細信息
      const errorInfo = getErrorDetails(errorCode);

      // 根據公開程度處理錯誤訊息
      switch (errorInfo.exposureLevel) {
        case 'hidden':
          // 完全隱藏技術細節，使用通用訊息
          errorResponse.message = '服務暫時不可用，請稍後再試';
          break;
        case 'masked':
          // 部分隱藏技術細節，但保留用戶可理解的信息
          if (errorCode.startsWith('PROVIDER_')) {
            errorResponse.message = '區塊鏈服務暫時不可用';
          } else if (errorCode.startsWith('BALANCE_')) {
            errorResponse.message = '無法獲取餘額資訊，請稍後再試';
          }
          // 移除所有可能包含的詳細錯誤或技術細節
          delete errorResponse['details'];
          break;
        case 'public':
        default:
          // 公開信息可以完整顯示，但仍然移除詳細技術堆棧
          delete errorResponse['details'];
          break;
      }
    }

    // 記錄錯誤
    this.logger.error(
      `${request.method} ${request.url} - ${status} ${errorCode}: ${message}`,
      exception instanceof Error ? exception.stack : 'No stack trace',
    );

    // 發送響應
    response.status(status).json(errorResponse);
  }
}
