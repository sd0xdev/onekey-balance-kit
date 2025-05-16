import { Injectable, Logger, Inject, Optional, Scope } from '@nestjs/common';
import { CacheMongoService } from '../../core/cache/cache-mongo.service';
import { ChainName, COIN_SYMBOL_TO_CHAIN_MAP } from '../../chains/constants';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  BalanceException,
  BlockchainException,
} from '../../common/exceptions/application.exception';
import { ChainServiceFactory } from '../../chains/services/core/chain-service.factory';
import {
  BalanceResponse as ModernBalanceResponse,
  isBalanceQueryable,
} from '../../chains/interfaces/balance-queryable.interface';
import { ProviderType } from '../../providers/constants/blockchain-types';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { CHAIN_INFO_MAP } from '../../chains/constants';
import { NotificationService } from '../../notification/notification.service';
import { BalanceResponse as LegacyBalanceResponse } from '../../chains/interfaces/chain-service.interface';

// 擴展Express的Request介面
interface RequestWithBlockchainProvider extends Request {
  blockchainProvider?: string;
}

// 統一的餘額響應類型
type BalanceResponse = ModernBalanceResponse;

@Injectable({ scope: Scope.REQUEST })
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    private readonly cacheMongoService: CacheMongoService,
    private readonly chainServiceFactory: ChainServiceFactory,
    @Optional() @Inject(REQUEST) private readonly request: RequestWithBlockchainProvider,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * 將輸入的鏈名稱或代幣符號規範化為標準 ChainName
   */
  private normalizeChainInput(chainNameOrSymbol: string): ChainName {
    const lowerCaseInput = chainNameOrSymbol.toLowerCase();

    // 檢查是否為有效的 ChainName
    if (Object.values(ChainName).includes(lowerCaseInput as ChainName)) {
      return lowerCaseInput as ChainName;
    }

    // 檢查是否為代幣符號
    const chain = COIN_SYMBOL_TO_CHAIN_MAP[lowerCaseInput];
    if (chain) {
      return chain;
    }

    // 如果都不是，拋出錯誤
    throw new BalanceException(
      ErrorCode.BALANCE_CHAIN_NOT_SUPPORTED,
      `Chain or symbol not supported: ${chainNameOrSymbol}`,
    );
  }

  /**
   * 從請求上下文中獲取提供者
   */
  private getProviderFromContext(): string | undefined {
    return this.request?.blockchainProvider;
  }

  /**
   * 將舊的 BalanceResponse 格式轉換為新格式
   */
  private convertLegacyBalanceToModern(
    balanceData: LegacyBalanceResponse,
    chainSymbol: string,
  ): ModernBalanceResponse {
    // 從舊版餘額數據中找到本幣的餘額
    const nativeToken = balanceData.find((token) => token.tokenAddress === null);

    // 構建新格式的本幣餘額
    const nativeBalance = {
      symbol: chainSymbol,
      decimals: 18, // 預設值，應根據實際情況調整
      balance: nativeToken?.balance || '0',
    };

    // 構建代幣列表
    const tokens = balanceData
      .filter((token) => token.tokenAddress !== null)
      .map((token) => ({
        mint: token.tokenAddress as string,
        tokenMetadata: {
          symbol: token.symbol,
          name: token.symbol,
          decimals: 18,
        },
        balance: token.balance,
      }));

    return {
      nativeBalance,
      tokens,
      nfts: [],
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * 獲取地址的投資組合（餘額信息）
   * 先嘗試從緩存獲取，如果緩存未命中則從鏈上獲取
   */
  async getPortfolio(chainNameOrSymbol: string, address: string): Promise<BalanceResponse> {
    const chain = this.normalizeChainInput(chainNameOrSymbol);
    const chainId = CHAIN_INFO_MAP[chain]?.id;

    if (!chainId) {
      throw new BalanceException(
        ErrorCode.BALANCE_CHAIN_NOT_SUPPORTED,
        `Chain ID not found for: ${chain}`,
      );
    }

    // 從請求上下文中獲取提供者
    const providerFromContext = this.getProviderFromContext();

    try {
      // 使用 CacheMongoService 獲取數據（優先Redis，再MongoDB）
      const cachedData = await this.cacheMongoService.getPortfolioData(
        chain,
        chainId,
        address,
        providerFromContext as ProviderType,
      );

      if (cachedData) {
        this.logger.debug(`Data found in cache or MongoDB for ${chain}:${address}`);
        return cachedData;
      }

      // 如果沒有緩存數據，從鏈上獲取
      this.logger.debug(`No cached data found, fetching from blockchain for ${chain}:${address}`);

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

      let balanceData: ModernBalanceResponse | LegacyBalanceResponse;

      // 先檢查是否實現了新的 BalanceQueryable 介面
      if (isBalanceQueryable(chainService)) {
        this.logger.debug(`Chain service implements BalanceQueryable interface`);
        balanceData = await chainService.getBalances(address, chainId, providerFromContext);
      }
      // 如果沒有實現新介面，但有舊的 getBalances 方法
      else if (typeof chainService.getBalances === 'function') {
        this.logger.debug(`Chain service has legacy getBalances method`);
        const legacyData = await chainService.getBalances(address, chainId);
        // 轉換為新格式
        balanceData = this.convertLegacyBalanceToModern(legacyData, chainService.getChainSymbol());
      } else {
        throw new BalanceException(
          ErrorCode.BALANCE_CHAIN_NOT_SUPPORTED,
          `Chain ${chain} does not support balance queries`,
        );
      }

      if (!balanceData) {
        throw new BalanceException(
          ErrorCode.BALANCE_FETCH_FAILED,
          `Failed to get balance for ${chain}:${address}`,
        );
      }

      // 確保結果具有必要的屬性
      const result: ModernBalanceResponse = {
        nativeBalance: balanceData.nativeBalance || {
          symbol: chainService.getChainSymbol(),
          decimals: 18,
          balance: '0',
        },
        tokens: balanceData.tokens || [],
        nfts: balanceData.nfts || [],
        updatedAt: balanceData.updatedAt || Math.floor(Date.now() / 1000),
      };

      // 直接使用通知中心發布事件，通過事件驅動方式進行緩存和MongoDB同步
      this.notificationService.emitPortfolioUpdate(
        chain,
        chainId,
        address,
        result,
        providerFromContext as ProviderType,
      );
      this.logger.debug(`Emitted portfolio update event for ${chain}:${address}`);

      return result;
    } catch (error) {
      this.logger.error(`Error fetching portfolio for ${chain}:${address}`, error);
      // 重新拋出錯誤，讓過濾器處理
      throw error;
    }
  }

  /**
   * 使地址相關的所有緩存失效
   */
  async invalidateAddressCache(chain: ChainName, address: string): Promise<number> {
    const chainId = CHAIN_INFO_MAP[chain]?.id;

    if (!chainId) {
      throw new BalanceException(
        ErrorCode.BALANCE_CHAIN_NOT_SUPPORTED,
        `Chain ID not found for: ${chain}`,
      );
    }

    return this.cacheMongoService.invalidateAddressCache(chain, chainId, address);
  }
}
