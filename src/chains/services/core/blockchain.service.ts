import { Injectable, Scope } from '@nestjs/common';
import { ChainService } from '../../interfaces/chain-service.interface';
import { ChainServiceFactory } from './chain-service.factory';
import { RequestContextService } from './request-context.service';

/**
 * 區塊鏈服務
 *
 * 整合 ChainServiceFactory 和請求上下文，提供簡潔的 API 來獲取區塊鏈服務
 * 注意：此服務需要在 REQUEST 作用域中使用，以獲取當前請求的提供者
 */
@Injectable({ scope: Scope.REQUEST })
export class BlockchainService {
  constructor(
    private readonly chainServiceFactory: ChainServiceFactory,
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * 獲取指定鏈的服務，使用當前請求上下文中的提供者
   *
   * @param chainNameOrSymbol 鏈名稱或代幣符號
   * @returns 鏈服務實例
   */
  getService(chainNameOrSymbol: string): ChainService {
    const provider = this.requestContext.getBlockchainProvider();
    return this.chainServiceFactory.getChainServiceWithProvider(chainNameOrSymbol, provider);
  }

  /**
   * 獲取指定鏈的服務，使用指定的提供者
   *
   * @param chainNameOrSymbol 鏈名稱或代幣符號
   * @param providerType 提供者類型
   * @returns 鏈服務實例
   */
  getServiceWithProvider(chainNameOrSymbol: string, providerType: string): ChainService {
    return this.chainServiceFactory.getChainServiceWithProvider(chainNameOrSymbol, providerType);
  }

  /**
   * 獲取指定鏈的服務，使用默認提供者
   *
   * @param chainNameOrSymbol 鏈名稱或代幣符號
   * @returns 鏈服務實例
   */
  getDefaultService(chainNameOrSymbol: string): ChainService {
    return this.chainServiceFactory.getChainService(chainNameOrSymbol);
  }

  /**
   * 檢查指定的鏈是否可用
   *
   * @param chainNameOrSymbol 鏈名稱或代幣符號
   * @returns 是否可用
   */
  isChainAvailable(chainNameOrSymbol: string): boolean {
    return this.chainServiceFactory.isChainAvailable(chainNameOrSymbol);
  }

  /**
   * 獲取所有可用的鏈名稱
   *
   * @returns 鏈名稱列表
   */
  getAvailableChains(): string[] {
    return this.chainServiceFactory.getAvailableChains();
  }
}
