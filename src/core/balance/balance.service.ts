import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { ChainName, COIN_SYMBOL_TO_CHAIN_MAP } from '../../chains/constants';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  BalanceException,
  BlockchainException,
} from '../../common/exceptions/application.exception';
import { ChainServiceFactory } from '../../chains/services/chain-service.factory';
import { BalanceableChainService } from '../../chains/interfaces/balanceable-chain.interface';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly chainServiceFactory: ChainServiceFactory,
  ) {}

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

    throw new BlockchainException(
      ErrorCode.BLOCKCHAIN_INVALID_CHAIN,
      `Chain ${input} not supported`,
    );
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

    // 2. 使用链服务工厂获取对应的链服务
    try {
      // 获取对应链的服务实例
      const chainService = this.chainServiceFactory.getChainService(chain);
      this.logger.debug(`Using chain service: ${chainService.getChainName()}`);

      if (!chainService.isValidAddress(address)) {
        throw new BlockchainException(
          ErrorCode.BLOCKCHAIN_INVALID_ADDRESS,
          `Invalid ${chain} address: ${address}`,
        );
      }

      // 確保鏈服務實現了 BalanceableChainService 介面
      if (!this.isBalanceableChainService(chainService)) {
        throw new BalanceException(
          ErrorCode.BALANCE_CHAIN_NOT_SUPPORTED,
          `Chain ${chain} does not support balance queries`,
        );
      }

      // 調用鏈服務的 getBalances 方法獲取餘額
      const balanceData = await chainService.getBalances(address);

      if (!balanceData) {
        throw new BalanceException(
          ErrorCode.BALANCE_FETCH_FAILED,
          `Failed to get balance for ${chain}:${address}`,
        );
      }

      // 3. 組裝結果數據 (确保统一的接口)
      const result = {
        // 使用链服务返回的数据
        ...balanceData,
        // 确保更新时间戳
        updatedAt: balanceData.updatedAt || Math.floor(Date.now() / 1000),
      };

      // 只有成功獲取數據時才緩存結果
      await this.cacheService.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error(`Error fetching portfolio for ${chain}:${address}`, error);
      // 重新拋出錯誤，讓過濾器處理
      throw error;
    }
  }

  /**
   * 檢查鏈服務是否實現了 BalanceableChainService 介面
   * @param service 鏈服務
   * @returns 是否實現了 BalanceableChainService 介面
   */
  private isBalanceableChainService(service: any): service is BalanceableChainService {
    return 'getBalances' in service && typeof service.getBalances === 'function';
  }
}
