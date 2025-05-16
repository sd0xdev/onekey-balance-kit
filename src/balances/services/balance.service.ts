import { Injectable, Logger, Inject, Optional, Scope } from '@nestjs/common';
import { CacheService } from '../../core/cache/cache.service';
import { CacheKeyService } from '../../core/cache/cache-key.service';
import { ChainName, COIN_SYMBOL_TO_CHAIN_MAP } from '../../chains/constants';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  BalanceException,
  BlockchainException,
} from '../../common/exceptions/application.exception';
import { ChainServiceFactory } from '../../chains/services/core/chain-service.factory';
import { isBalanceQueryable } from '../../chains/interfaces/balance-queryable.interface';
import { ProviderType } from '../../providers/constants/blockchain-types';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable({ scope: Scope.REQUEST })
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheKeyService: CacheKeyService,
    private readonly chainServiceFactory: ChainServiceFactory,
    @Optional() @Inject(REQUEST) private readonly request: Request,
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

  /**
   * 從請求上下文中獲取區塊鏈提供者
   *
   * @returns 標準化的提供者類型
   */
  private getProviderFromContext(): ProviderType | undefined {
    // 從請求上下文中獲取提供者
    if (this.request && (this.request as any).blockchainProvider) {
      return this.normalizeProviderType((this.request as any).blockchainProvider);
    }

    // 如果請求上下文中沒有提供者，返回 undefined，讓服務使用默認提供者
    return undefined;
  }

  async getPortfolio(chainNameOrSymbol: string, address: string) {
    const chain = this.normalizeChainInput(chainNameOrSymbol);

    // 從請求上下文中獲取提供者
    const providerFromContext = this.getProviderFromContext();

    // 使用 CacheKeyService 創建緩存鍵
    const cacheKey = this.cacheKeyService.createPortfolioKey(chain, address, providerFromContext);

    const cachedData = await this.cacheService.get(cacheKey);
    if (cachedData) {
      this.logger.debug(`Cache hit for key ${cacheKey}`);
      return cachedData;
    } else {
      this.logger.debug(`Cache miss for key ${cacheKey}`);
    }

    // 使用鏈服務工廠獲取對應的鏈服務
    try {
      // 獲取對應鏈的服務實例 (根據是否有上下文提供者使用不同方法)
      const chainService = providerFromContext
        ? this.chainServiceFactory.getChainServiceWithProvider(chain, providerFromContext)
        : this.chainServiceFactory.getChainService(chain);

      this.logger.debug(`Using chain service: ${chainService.getChainName()}`);
      this.logger.debug(`Provider: ${providerFromContext || 'default'}`);

      if (!chainService.isValidAddress(address)) {
        throw new BlockchainException(
          ErrorCode.BLOCKCHAIN_INVALID_ADDRESS,
          `Invalid ${chain} address: ${address}`,
        );
      }

      // 確保鏈服務實現了 BalanceQueryable 介麵
      if (!isBalanceQueryable(chainService)) {
        throw new BalanceException(
          ErrorCode.BALANCE_CHAIN_NOT_SUPPORTED,
          `Chain ${chain} does not support balance queries`,
        );
      }

      // 調用鏈服務的 getBalances 方法獲取餘額
      const balanceData = await chainService.getBalances(address, false);

      if (!balanceData) {
        throw new BalanceException(
          ErrorCode.BALANCE_FETCH_FAILED,
          `Failed to get balance for ${chain}:${address}`,
        );
      }

      // 組裝結果數據 (確保統一的接口)
      const result = {
        // 使用鏈服務返回的數據
        ...balanceData,
        // 確保更新時間戳
        updatedAt: balanceData.updatedAt || Math.floor(Date.now() / 1000),
      };

      // 隻有成功獲取數據時才緩存結果
      await this.cacheService.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error(`Error fetching portfolio for ${chain}:${address}`, error);
      // 重新拋出錯誤，讓過濾器處理
      throw error;
    }
  }

  /**
   * 將提供者類型輸入標準化為有效的 ProviderType
   * @param input 輸入的提供者類型字串
   * @returns 標準化的 ProviderType 或 undefined (如果輸入無效)
   */
  private normalizeProviderType(input?: string): ProviderType | undefined {
    if (!input) return undefined;

    const lowercaseInput = input.toLowerCase();

    // 檢查是否為有效的 ProviderType
    const isValidProvider = Object.values(ProviderType).some(
      (value) => value.toLowerCase() === lowercaseInput,
    );

    if (isValidProvider) {
      return lowercaseInput as ProviderType;
    }

    this.logger.warn(`Invalid provider type: ${input}, using default provider`);
    return undefined;
  }
}
