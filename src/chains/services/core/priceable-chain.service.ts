import { Logger } from '@nestjs/common';
import { AbstractPriceService } from '../../../prices/interfaces/abstract-price.service';
import { TokenBalance } from '../../interfaces/token-balance.interface';
import { AbstractChainService } from './abstract-chain.service';

/**
 * 可報價鏈服務抽象類
 * 為鏈服務增加價格查詢和幣值轉換能力
 */
export abstract class PriceableChainService extends AbstractChainService {
  protected readonly logger = new Logger(PriceableChainService.name);

  /**
   * 建構子
   * @param priceService 價格服務
   */
  constructor(protected readonly priceService: AbstractPriceService) {
    super();
  }

  /**
   * 判斷是否應該獲取價格
   * 預設邏輯：主網取價格，測試網不取
   * 子類可以覆寫此方法改變行為
   */
  protected shouldQuote(): boolean {
    return !this.isTestnet();
  }

  /**
   * 判斷當前鏈是否為測試網
   * 由子類實現
   */
  protected abstract isTestnet(): boolean;

  /**
   * 為代幣餘額添加 USD 價格
   * @param balances 原始代幣餘額列表
   * @returns 包含 USD 價格的代幣餘額列表
   */
  protected async quote(balances: TokenBalance[]): Promise<TokenBalance[]> {
    // 測試網直接歸零返回
    if (!this.shouldQuote()) {
      return balances.map((balance) => ({
        ...balance,
        usdValue: 0,
      }));
    }

    try {
      // 獲取代幣地址列表
      const tokens = balances.map((balance) => balance.tokenAddress);

      // 如果沒有代幣需要查詢，直接返回
      if (tokens.length === 0) {
        return balances;
      }

      // 獲取價格
      const chainId = this.getChainId();
      const prices = await this.priceService.getPrices({
        chainId,
        tokens,
      });

      // 為每個代幣計算 USD 價值
      return balances.map((balance) => {
        const price = prices.get(balance.tokenAddress.toLowerCase()) || 0;
        const usdValue = price * parseFloat(balance.balance);

        return {
          ...balance,
          usdValue: usdValue,
        };
      });
    } catch (error) {
      // 價格服務失敗時，不影響餘額查詢，僅將 USD 價值設為 0
      this.logger.warn(`獲取價格失敗: ${error.message}`, error.stack);

      return balances.map((balance) => ({
        ...balance,
        usdValue: 0,
      }));
    }
  }

  /**
   * 獲取當前鏈的 Chain ID
   */
  protected abstract getChainId(): number;
}
