import { Injectable } from '@nestjs/common';

/**
 * 代幣價格請求參數
 */
export interface PriceRequest {
  /** 區塊鏈 ID */
  chainId: number;
  /** 代幣地址列表 */
  tokens: string[];
}

/**
 * 抽象價格服務
 * 單一職責：獲取指定代幣的 USD 價格
 */
@Injectable()
export abstract class AbstractPriceService {
  /**
   * 獲取多個代幣的價格
   * @param request 包含 chainId 和 tokens 的請求參數
   * @returns 代幣地址到價格的映射
   */
  abstract getPrices(request: PriceRequest): Promise<Map<string, number>>;
}
