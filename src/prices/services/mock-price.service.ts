import { Injectable, Logger } from '@nestjs/common';
import { AbstractPriceService, PriceRequest } from '../interfaces/abstract-price.service';

/**
 * 模擬價格服務
 * 用於開發和測試環境，不會呼叫外部 API
 */
@Injectable()
export class MockPriceService extends AbstractPriceService {
  private readonly logger = new Logger(MockPriceService.name);
  private readonly mockPrices: Record<string, Record<string, number>> = {
    // ETH Mainnet (chainId: 1)
    '1': {
      // 以太坊主網常見代幣模擬價格
      '0x0000000000000000000000000000000000000000': 3000, // ETH
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 1.0, // USDC
      '0xdAC17F958D2ee523a2206206994597C13D831ec7': 1.0, // USDT
      '0x6B175474E89094C44Da98b954EedeAC495271d0F': 1.0, // DAI
    },
  };

  /**
   * 獲取模擬價格
   * @param request 價格請求參數
   * @returns 代幣地址到價格的映射
   */
  async getPrices(request: PriceRequest): Promise<Map<string, number>> {
    const { chainId, tokens } = request;
    this.logger.debug(`[模擬] 獲取價格 chainId: ${chainId}, tokens: ${tokens.length}個`);

    const prices = new Map<string, number>();
    const chainPrices = this.mockPrices[chainId.toString()] || {};

    // 為請求的每個代幣分配價格
    for (const token of tokens) {
      const price = chainPrices[token.toLowerCase()] || 0;
      prices.set(token.toLowerCase(), price);
    }

    return prices;
  }
}
