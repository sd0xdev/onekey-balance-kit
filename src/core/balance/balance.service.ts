import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { ChainName, CHAIN_INFO_MAP, COIN_SYMBOL_TO_CHAIN_MAP } from '../../chains/constants';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * 將輸入標準化為有效的鏈名稱
   * 支援鏈名稱或代幣符號作為輸入
   * @param input 輸入的鏈名稱或代幣符號
   * @returns 標準化的鏈名稱
   */
  private normalizeChainInput(input: string): ChainName {
    const lowercaseInput = input.toLowerCase();

    // 檢查是否為代幣符號，如果是則轉換為對應的鏈名稱
    if (COIN_SYMBOL_TO_CHAIN_MAP[lowercaseInput]) {
      return COIN_SYMBOL_TO_CHAIN_MAP[lowercaseInput];
    }

    // 如果輸入已經是有效的 ChainName，則直接轉換
    if (Object.values(ChainName).includes(lowercaseInput as ChainName)) {
      return lowercaseInput as ChainName;
    }

    throw new NotFoundException(`Chain ${input} not supported`);
  }

  async getPortfolio(chainNameOrSymbol: string, address: string) {
    const chain = this.normalizeChainInput(chainNameOrSymbol);

    // 1. 先从缓存获取 (使用標準化的鏈名稱作為鍵的一部分)
    const cacheKey = `portfolio:${chain}:${address}`;
    const cachedData = await this.cacheService.get(cacheKey);
    if (cachedData) {
      this.logger.debug(`Cache hit for key ${cacheKey}`);
      return cachedData;
    } else {
      this.logger.debug(`Cache miss for key ${cacheKey}`);
    }

    // 2. 實際實現會在具體鏈的服務中完成，這裡只是接口定義
    // 3. 設置快取並返回數據
    // 實際實現時，這裡會調用鏈特定的服務
    const result = {
      chainId: CHAIN_INFO_MAP[chain].id,
      chainName: CHAIN_INFO_MAP[chain].name,
      native: {},
      fungibles: [],
      nfts: [],
      updatedAt: Math.floor(Date.now() / 1000),
    };

    // 使用 CacheService 設置快取，讓它使用默認的快取時間
    await this.cacheService.set(cacheKey, result);
    return result;
  }
}
