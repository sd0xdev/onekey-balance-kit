import { Injectable, Type } from '@nestjs/common';
import { DiscoveryService as NestDiscoveryService } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { CHAIN_METADATA } from '../../constants/index';
import { ChainService } from '../../interfaces/chain-service.interface';
import { ChainMeta, GLOBAL_CHAIN_SERVICE_MAP } from '../../decorators/chain.decorator';

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

      const chainMeta = this.reflector.get(CHAIN_METADATA, metatype);

      if (chainMeta) {
        // 確保 metatype 是 Type<ChainService> 類型
        const serviceType = metatype as Type<ChainService>;

        // 註冊主網名稱
        result.set(chainMeta.mainnet.toLowerCase(), serviceType);

        // 註冊所有測試網名稱
        if (chainMeta.testnets) {
          for (const testnet of chainMeta.testnets) {
            result.set(testnet.toLowerCase(), serviceType);
          }
        }
      }
    });

    return result;
  }

  /**
   * 獲取所有使用 @Chain 裝飾器標記的鏈名稱
   * 包括主網和測試網
   * @returns 鏈名稱列表
   */
  getRegisteredChainNames(): string[] {
    // 直接從全局映射獲取所有註冊的鏈名稱
    return Array.from(GLOBAL_CHAIN_SERVICE_MAP.keys());
  }
}
