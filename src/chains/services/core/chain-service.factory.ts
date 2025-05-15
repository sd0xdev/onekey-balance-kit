import { Injectable, NotFoundException, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ChainService, ProviderAware } from '../../interfaces/chain-service.interface';
import { DiscoveryService } from './discovery.service';
import { COIN_SYMBOL_TO_CHAIN_MAP } from '../../constants';

/**
 * ChainServiceFactory 是一個工廠類，用於創建和管理不同區塊鏈的服務實例
 */
@Injectable()
export class ChainServiceFactory {
  private readonly chainServices = new Map<string, ChainService>();
  private readonly chainServiceTypes = new Map<string, Type<ChainService>>();
  // 用於存儲特定提供者的服務實例
  private readonly providerSpecificServices = new Map<string, Map<string, ChainService>>();

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
   * 獲取指定鏈和提供者的服務
   * @param chainNameOrSymbol 鏈名稱或代幣符號
   * @param providerType 指定的提供者類型
   * @returns 鏈服務實例
   */
  getChainServiceWithProvider(chainNameOrSymbol: string, providerType: string): ChainService {
    const normalizedChainName = this.normalizeChainInput(chainNameOrSymbol);

    // 檢查是否已有特定提供者的服務實例
    const providerSpecificMap = this.providerSpecificServices.get(normalizedChainName);
    if (providerSpecificMap && providerSpecificMap.has(providerType)) {
      return providerSpecificMap.get(providerType)!;
    }

    // 創建基礎服務實例，不修改其默認提供者
    const baseService = this.getChainService(normalizedChainName);

    // 創建一個代理服務，包裝原始服務
    const proxyService = Object.create(Object.getPrototypeOf(baseService));

    // 複製原始服務的所有屬性到代理服務
    Object.assign(proxyService, baseService);

    // 如果服務實現了 ProviderAware 介面，覆蓋提供者相關方法
    if (this.isProviderAware(baseService)) {
      // 覆蓋 getDefaultProvider 方法，使其始終返回指定的提供者
      (proxyService as ProviderAware).getDefaultProvider = function () {
        return providerType;
      };

      // 覆蓋 setDefaultProvider 方法，防止修改代理服務的提供者
      (proxyService as ProviderAware).setDefaultProvider = function () {
        // 不執行任何操作，保持固定的提供者
      };
    }

    // 存儲特定提供者的服務代理
    if (!providerSpecificMap) {
      this.providerSpecificServices.set(normalizedChainName, new Map<string, ChainService>());
    }
    this.providerSpecificServices.get(normalizedChainName)!.set(providerType, proxyService);

    return proxyService;
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

    // 創建新的服務實例
    const service = this.createChainServiceInstance(normalizedChainName);
    this.chainServices.set(normalizedChainName, service);
    return service;
  }

  /**
   * 創建鏈服務實例
   * @param normalizedChainName 標準化後的鏈名稱
   * @returns 鏈服務實例
   */
  private createChainServiceInstance(normalizedChainName: string): ChainService {
    // 檢查是否已註冊服務類型
    if (this.chainServiceTypes.has(normalizedChainName)) {
      const serviceType = this.chainServiceTypes.get(normalizedChainName);
      if (serviceType) {
        const service = this.moduleRef.get(serviceType, { strict: false });

        if (service) {
          return service;
        }
      }
    }

    throw new NotFoundException(`Chain service for ${normalizedChainName} not found`);
  }

  /**
   * 檢查服務是否實現了 ProviderAware 介面
   * @param service 鏈服務
   * @returns 是否實現了 ProviderAware 介面
   */
  private isProviderAware(service: any): service is ProviderAware {
    return (
      typeof service.setDefaultProvider === 'function' &&
      typeof service.getDefaultProvider === 'function'
    );
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
