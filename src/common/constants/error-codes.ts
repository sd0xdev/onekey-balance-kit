import { HttpStatus } from '@nestjs/common';

/**
 * 應用錯誤代碼
 *
 * 錯誤代碼格式: CATEGORY_ERROR_NAME
 * - 分類前綴: 表示錯誤所屬的模塊或類型
 * - 錯誤名稱: 描述具體的錯誤情況
 */
export enum ErrorCode {
  // 通用錯誤 (1000-1999)
  COMMON_INTERNAL_ERROR = 'COMMON_INTERNAL_ERROR',
  COMMON_BAD_REQUEST = 'COMMON_BAD_REQUEST',
  COMMON_NOT_FOUND = 'COMMON_NOT_FOUND',
  COMMON_UNAUTHORIZED = 'COMMON_UNAUTHORIZED',
  COMMON_FORBIDDEN = 'COMMON_FORBIDDEN',
  COMMON_VALIDATION_ERROR = 'COMMON_VALIDATION_ERROR',

  // 區塊鏈相關錯誤 (2000-2999)
  BLOCKCHAIN_INVALID_ADDRESS = 'BLOCKCHAIN_INVALID_ADDRESS',
  BLOCKCHAIN_INVALID_CHAIN = 'BLOCKCHAIN_INVALID_CHAIN',
  BLOCKCHAIN_INVALID_TRANSACTION = 'BLOCKCHAIN_INVALID_TRANSACTION',

  // 提供者相關錯誤 (3000-3999)
  PROVIDER_AUTH_FAILED = 'PROVIDER_AUTH_FAILED',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  PROVIDER_RATE_LIMIT = 'PROVIDER_RATE_LIMIT',
  PROVIDER_NOT_SUPPORTED = 'PROVIDER_NOT_SUPPORTED',
  PROVIDER_REQUEST_FAILED = 'PROVIDER_REQUEST_FAILED',

  // 餘額相關錯誤 (4000-4999)
  BALANCE_FETCH_FAILED = 'BALANCE_FETCH_FAILED',
  BALANCE_PARSING_ERROR = 'BALANCE_PARSING_ERROR',

  // 快取相關錯誤 (5000-5999)
  CACHE_SET_FAILED = 'CACHE_SET_FAILED',
  CACHE_GET_FAILED = 'CACHE_GET_FAILED',
}

/**
 * 錯誤代碼詳細信息
 */
export interface ErrorDetails {
  // HTTP狀態碼
  httpStatus: HttpStatus;
  // 預設錯誤訊息
  message: string;
  // 公開程度: public表示在生產環境中可以完整顯示; masked表示需要簡化; hidden表示需要隱藏技術細節
  exposureLevel?: 'public' | 'masked' | 'hidden';
}

/**
 * 錯誤代碼映射
 * 將每個錯誤代碼映射到對應的HTTP狀態碼和預設錯誤訊息
 */
export const ERROR_MAPPINGS: Record<ErrorCode, ErrorDetails> = {
  // 通用錯誤
  [ErrorCode.COMMON_INTERNAL_ERROR]: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    message: '伺服器發生錯誤',
    exposureLevel: 'hidden',
  },
  [ErrorCode.COMMON_BAD_REQUEST]: {
    httpStatus: HttpStatus.BAD_REQUEST,
    message: '無效的請求',
    exposureLevel: 'public',
  },
  [ErrorCode.COMMON_NOT_FOUND]: {
    httpStatus: HttpStatus.NOT_FOUND,
    message: '找不到請求的資源',
    exposureLevel: 'public',
  },
  [ErrorCode.COMMON_UNAUTHORIZED]: {
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: '未授權的訪問',
    exposureLevel: 'public',
  },
  [ErrorCode.COMMON_FORBIDDEN]: {
    httpStatus: HttpStatus.FORBIDDEN,
    message: '禁止訪問該資源',
    exposureLevel: 'public',
  },
  [ErrorCode.COMMON_VALIDATION_ERROR]: {
    httpStatus: HttpStatus.BAD_REQUEST,
    message: '請求參數驗證失敗',
    exposureLevel: 'public',
  },

  // 區塊鏈相關錯誤
  [ErrorCode.BLOCKCHAIN_INVALID_ADDRESS]: {
    httpStatus: HttpStatus.BAD_REQUEST,
    message: '無效的區塊鏈地址',
    exposureLevel: 'public',
  },
  [ErrorCode.BLOCKCHAIN_INVALID_CHAIN]: {
    httpStatus: HttpStatus.BAD_REQUEST,
    message: '無效的區塊鏈類型',
    exposureLevel: 'public',
  },
  [ErrorCode.BLOCKCHAIN_INVALID_TRANSACTION]: {
    httpStatus: HttpStatus.BAD_REQUEST,
    message: '無效的交易資訊',
    exposureLevel: 'public',
  },

  // 提供者相關錯誤
  [ErrorCode.PROVIDER_AUTH_FAILED]: {
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: '提供者API認證失敗',
    exposureLevel: 'masked',
  },
  [ErrorCode.PROVIDER_UNAVAILABLE]: {
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    message: '區塊鏈提供者服務不可用',
    exposureLevel: 'masked',
  },
  [ErrorCode.PROVIDER_RATE_LIMIT]: {
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    message: '超過提供者API請求限制',
    exposureLevel: 'masked',
  },
  [ErrorCode.PROVIDER_NOT_SUPPORTED]: {
    httpStatus: HttpStatus.NOT_IMPLEMENTED,
    message: '不支援的區塊鏈提供者',
    exposureLevel: 'masked',
  },
  [ErrorCode.PROVIDER_REQUEST_FAILED]: {
    httpStatus: HttpStatus.BAD_GATEWAY,
    message: '提供者API請求失敗',
    exposureLevel: 'masked',
  },

  // 餘額相關錯誤
  [ErrorCode.BALANCE_FETCH_FAILED]: {
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    message: '無法獲取區塊鏈餘額',
    exposureLevel: 'masked',
  },
  [ErrorCode.BALANCE_PARSING_ERROR]: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    message: '餘額資料解析錯誤',
    exposureLevel: 'hidden',
  },

  // 快取相關錯誤
  [ErrorCode.CACHE_SET_FAILED]: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    message: '設置快取失敗',
    exposureLevel: 'hidden',
  },
  [ErrorCode.CACHE_GET_FAILED]: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    message: '獲取快取失敗',
    exposureLevel: 'hidden',
  },
};

/**
 * 根據HTTP狀態碼獲取對應的錯誤代碼
 * @param status HTTP狀態碼
 * @returns 對應的錯誤代碼
 */
export function getErrorCodeFromStatus(status: HttpStatus): ErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ErrorCode.COMMON_BAD_REQUEST;
    case HttpStatus.UNAUTHORIZED:
      return ErrorCode.COMMON_UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ErrorCode.COMMON_FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ErrorCode.COMMON_NOT_FOUND;
    case HttpStatus.INTERNAL_SERVER_ERROR:
    default:
      return ErrorCode.COMMON_INTERNAL_ERROR;
  }
}

/**
 * 獲取錯誤詳細信息
 * @param errorCode 錯誤代碼
 * @returns 錯誤詳細信息，包括HTTP狀態碼和預設訊息
 */
export function getErrorDetails(errorCode: ErrorCode): ErrorDetails {
  return ERROR_MAPPINGS[errorCode] || ERROR_MAPPINGS[ErrorCode.COMMON_INTERNAL_ERROR];
}
