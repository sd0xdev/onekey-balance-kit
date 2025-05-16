import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ChainService } from '../../interfaces/chain-service.interface';
import { CHAIN_INFO_MAP } from '../../constants';
import { GLOBAL_CHAIN_SERVICE_MAP } from '../../decorators/chain.decorator';
import { AbstractEvmChainService } from './abstract-evm-chain.service';

/**
 * 鏈路由服務
 * 負責將請求路由到對應的鏈服務
 */
@Injectable()
export class ChainRouter {
  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * 根據鏈ID分發請求到對應的鏈服務
   * @param chainId 鏈ID
   * @param action 對服務執行的操作函數
   * @returns 操作執行結果
   */
  dispatch<T>(chainId: number, action: (service: ChainService) => T): T {
    // 1. 通過鏈ID查找鏈名稱
    const chainName = this.getChainNameByChainId(chainId);
    if (!chainName) {
      throw new NotFoundException(`未找到鏈ID為 ${chainId} 的鏈服務`);
    }

    // 2. 通過鏈名稱查找對應的服務類
    const serviceClass = GLOBAL_CHAIN_SERVICE_MAP.get(chainName);
    if (!serviceClass) {
      throw new NotFoundException(`未找到鏈名稱為 ${chainName} 的服務`);
    }

    // 3. 獲取服務實例
    const service = this.moduleRef.get(serviceClass, { strict: false });
    if (!service) {
      throw new NotFoundException(`無法實例化 ${serviceClass.name} 服務`);
    }

    // 4. 如果是EVM鏈服務，設置當前鏈ID
    if (this.isEvmChainService(service)) {
      service.setChainId(chainId);
    }

    // 5. 執行操作並返回結果
    return action(service);
  }

  /**
   * 根據鏈ID獲取鏈名稱
   * @param chainId 鏈ID
   * @returns 鏈名稱
   */
  private getChainNameByChainId(chainId: number): string | null {
    for (const [name, info] of Object.entries(CHAIN_INFO_MAP)) {
      if (info.id === chainId) {
        return name;
      }
    }
    return null;
  }

  /**
   * 判斷是否為EVM鏈服務
   * @param service 鏈服務
   * @returns 是否為EVM鏈服務
   */
  private isEvmChainService(service: any): service is AbstractEvmChainService {
    return service instanceof AbstractEvmChainService;
  }
}
