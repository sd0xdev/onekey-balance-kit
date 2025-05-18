import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AbstractEvmChainService } from './abstract-evm-chain.service';
import { AbstractPriceService } from '../../../prices/interfaces/abstract-price.service';
import { ProviderFactory } from '../../../providers/provider.factory';
import { BalanceResponse } from '../../interfaces/balance-queryable.interface';

/**
 * 可報價的EVM鏈服務
 * 繼承自AbstractEvmChainService，增加價格查詢功能
 */
@Injectable()
export abstract class PriceableEvmChainService extends AbstractEvmChainService {
  constructor(
    protected readonly providerFactory: ProviderFactory,
    protected readonly configService: ConfigService,
    protected readonly priceService: AbstractPriceService,
  ) {
    super(providerFactory, configService);
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
   * 重寫獲取餘額方法，增加價格查詢
   * @param address 區塊鏈地址
   * @param chainId 鏈ID（可選）
   * @param providerType 提供者類型（可選）
   */
  async getBalances(
    address: string,
    chainId?: number,
    providerType?: string,
  ): Promise<BalanceResponse> {
    // 先獲取原始餘額
    const balances = await super.getBalances(address, chainId, providerType);

    // 如果不需要報價，直接返回（usd值為0）
    if (!this.shouldQuote()) {
      this.logDebug(`${this.getChainName()} 是測試網或設置為不報價，跳過價格查詢`);
      return balances;
    }

    try {
      // 準備代幣地址列表
      // 原生代幣使用零地址
      const tokens = [
        '0x0000000000000000000000000000000000000000', // 原生代幣
        ...balances.fungibles.map((token) => token.mint),
      ];

      // 獲取價格
      const prices = await this.priceService.getPrices({
        chainId: this.getChainId(),
        tokens,
      });

      // 更新原生代幣價格
      const nativePrice = prices.get('0x0000000000000000000000000000000000000000') || 0;
      balances.nativeBalance.usd =
        (nativePrice * parseFloat(balances.nativeBalance.balance)) /
        10 ** balances.nativeBalance.decimals;

      // 更新其他代幣價格
      balances.fungibles = balances.fungibles.map((fungible) => {
        const price = prices.get(fungible.mint.toLowerCase()) || 0;
        return {
          ...fungible,
          usd: (price * parseFloat(fungible.balance)) / 10 ** fungible.decimals,
        };
      });

      this.logDebug(`成功更新 ${this.getChainName()} 餘額的價格信息`);
      return balances;
    } catch (error) {
      // 價格查詢失敗，不影響餘額查詢結果
      this.logWarn(`更新 ${this.getChainName()} 價格失敗: ${error.message}`);
      throw error;
    }
  }
}
