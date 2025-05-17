import { Injectable, Type } from '@nestjs/common';
import { DiscoveryService as NestDiscoveryService, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { BlockchainProviderInterface } from './interfaces/blockchain-provider.interface';
import { PROVIDER_METADATA } from './constants/provider-metadata';
import { ProviderRegistration } from './constants/provider-registration';
import { ProviderMeta } from './decorators/provider.decorator';

@Injectable()
export class ProviderDiscoveryService {
  constructor(
    private readonly discoveryService: NestDiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  /**
   * 發現所有標記了 @Provider 裝飾器的提供者
   * @returns 提供者註冊信息列表
   */
  discoverProviders(): ProviderRegistration[] {
    const providers = this.discoveryService.getProviders();
    const result: ProviderRegistration[] = [];

    providers.forEach((wrapper: InstanceWrapper) => {
      const { instance, metatype } = wrapper;

      if (!instance || !metatype) {
        return;
      }

      const metadata = this.reflector.get(PROVIDER_METADATA, metatype);

      if (metadata) {
        const { blockchainTypes, providerType, blockchainType } = metadata;
        // 確保 metatype 是 Type<BlockchainProviderInterface> 類型
        const providerClass = metatype as Type<BlockchainProviderInterface>;

        // 為每個支援的區塊鏈類型創建一個註冊
        if (blockchainTypes) {
          blockchainTypes.forEach((type) => {
            result.push({
              blockchainType: type,
              providerType,
              providerClass,
              originalBlockchainType: blockchainType, // 添加原始區塊鏈類型
            });
          });
        }
      }
    });

    return result;
  }

  /**
   * 獲取所有使用 @Provider 裝飾器標記的提供者類型列表
   * @returns 提供者類型列表
   */
  getRegisteredProviderTypes(): { blockchainType: string; providerType: string }[] {
    const providerRegistrations = this.discoverProviders();
    return providerRegistrations.map(({ blockchainType, providerType }) => ({
      blockchainType,
      providerType,
    }));
  }
}
