import { Injectable, NotFoundException, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ChainService } from '../interfaces/chain-service.interface';
import { DiscoveryService } from './discovery.service';
import { COIN_SYMBOL_TO_CHAIN_MAP } from '../constants';

/**
 * ChainServiceFactory 是一個工廠類，用於創建和管理不同區塊鏈的服務實例
 */
@Injectable()
export class ChainServiceFactory {
  private readonly chainServices = new Map<string, ChainService>();
  private readonly chainServiceTypes = new Map<string, Type<ChainService>>();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService: DiscoveryService,
  ) {}

  /**
   * 初始化工廠，自動發現和註冊所有標記了 @Chain 裝飾器的服務
   */
  onModuleInit() {
    // 使用 DiscoveryService 發現所有標記了 @Chain 裝飾器的服務
    const discoveredServices = this.discoveryService.discoverChainServices();

    // 註冊發現的服務
    for (const [chainName, serviceType] of discoveredServices) {
      this.registerChainServiceType(chainName, serviceType);
    }
  }

  /**
   * 註冊鏈服務類型
   * @param chainName 鏈名稱
   * @param serviceType 服務類型
   */
  registerChainServiceType(chainName: string, serviceType: Type<ChainService>): void {
    this.chainServiceTypes.set(chainName.toLowerCase(), serviceType);
  }

  /**
   * 註冊鏈服務實例
   * @param chainName 鏈名稱
   * @param service 服務實例
   */
  registerChainService(chainName: string, service: ChainService): void {
    this.chainServices.set(chainName.toLowerCase(), service);
  }

  /**
   * 將輸入標準化為有效的鏈名稱
   * 支援鏈名稱或代幣符號作為輸入
   * @param input 輸入的鏈名稱或代幣符號
   * @returns 標準化的鏈名稱
   */
  private normalizeChainInput(input: string): string {
    const lowercaseInput = input.toLowerCase();

    // 檢查是否為代幣符號，如果是則轉換為對應的鏈名稱
    if (COIN_SYMBOL_TO_CHAIN_MAP[lowercaseInput]) {
      return COIN_SYMBOL_TO_CHAIN_MAP[lowercaseInput].toLowerCase();
    }

    return lowercaseInput;
  }

  /**
   * 獲取指定鏈的服務
   * @param chainNameOrSymbol 鏈名稱或代幣符號
   * @returns 鏈服務實例
   */
  getChainService(chainNameOrSymbol: string): ChainService {
    const normalizedChainName = this.normalizeChainInput(chainNameOrSymbol);

    // 檢查是否已有服務實例
    if (this.chainServices.has(normalizedChainName)) {
      const service = this.chainServices.get(normalizedChainName);
      if (service) {
        return service;
      }
    }

    // 檢查是否已註冊服務類型，若有則創建實例
    if (this.chainServiceTypes.has(normalizedChainName)) {
      const serviceType = this.chainServiceTypes.get(normalizedChainName);
      if (serviceType) {
        const service = this.moduleRef.get(serviceType, { strict: false });

        if (service) {
          this.chainServices.set(normalizedChainName, service);
          return service;
        }
      }
    }

    throw new NotFoundException(`Chain service for ${chainNameOrSymbol} not found`);
  }

  /**
   * 獲取所有可用的鏈名稱
   * @returns 鏈名稱列表
   */
  getAvailableChains(): string[] {
    // 合併已註冊的服務實例和類型的鏈名稱
    const chains = new Set([...this.chainServices.keys(), ...this.chainServiceTypes.keys()]);

    return Array.from(chains);
  }

  /**
   * 檢查指定的鏈是否可用
   * @param chainNameOrSymbol 鏈名稱或代幣符號
   * @returns 是否可用
   */
  isChainAvailable(chainNameOrSymbol: string): boolean {
    const normalizedChainName = this.normalizeChainInput(chainNameOrSymbol);
    return (
      this.chainServices.has(normalizedChainName) || this.chainServiceTypes.has(normalizedChainName)
    );
  }
}
