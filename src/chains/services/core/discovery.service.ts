import { Injectable, Type } from '@nestjs/common';
import { DiscoveryService as NestDiscoveryService } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { CHAIN_METADATA } from '../../constants/index';
import { ChainService } from '../../interfaces/chain-service.interface';

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly discoveryService: NestDiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  /**
   * 發現所有標記了 @Chain 裝飾器的服務
   * @returns 鏈名稱與服務類型的映射
   */
  discoverChainServices(): Map<string, Type<ChainService>> {
    const providers = this.discoveryService.getProviders();
    const result = new Map<string, Type<ChainService>>();

    providers.forEach((wrapper: InstanceWrapper) => {
      const { instance, metatype } = wrapper;

      if (!instance || !metatype) {
        return;
      }

      const chainName = this.reflector.get(CHAIN_METADATA, metatype);

      if (chainName) {
        // 確保 metatype 是 Type<ChainService> 類型
        const serviceType = metatype as Type<ChainService>;
        result.set(chainName.toLowerCase(), serviceType);
      }
    });

    return result;
  }

  /**
   * 獲取所有使用 @Chain 裝飾器標記的服務名稱列表
   * @returns 服務名稱列表
   */
  getRegisteredChainNames(): string[] {
    const chainServices = this.discoverChainServices();
    return Array.from(chainServices.keys());
  }
}
