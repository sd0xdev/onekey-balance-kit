import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
  Type,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { BlockchainProviderInterface } from './interfaces/blockchain-provider.interface';
import { EthereumProviderInterface } from './interfaces/ethereum-provider.interface';
import { SolanaProviderInterface } from './interfaces/solana-provider.interface';
import { ProviderType, CHAIN_TO_DEFAULT_PROVIDER_MAP } from './constants/blockchain-types';
import {
  PROVIDERS_TOKEN,
  ProviderDescriptor,
  ProviderRegistration,
} from './constants/provider-registration';
import { ProviderDiscoveryService } from './provider-discovery.service';
import { ChainName, COIN_SYMBOL_TO_CHAIN_MAP, CHAIN_INFO_MAP } from '../chains/constants';

/**
 * 提供者工廠類
 * 用於獲取和管理區塊鏈資料提供者實例
 */
@Injectable()
export class ProviderFactory implements OnModuleInit {
  private providers = new Map<string, Map<string, Type<BlockchainProviderInterface>>>();
  private instances = new Map<string, Map<string, BlockchainProviderInterface>>();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly configService: ConfigService,
    private readonly discoveryService: ProviderDiscoveryService,
    @Optional()
    @Inject(PROVIDERS_TOKEN)
    private readonly registeredProviders: ProviderRegistration[] = [],
  ) {
    this.registerProviders(registeredProviders);
  }

  /**
   * 初始化時自動發現和註冊所有標記了 @Provider 裝飾器的提供者
   */
  onModuleInit() {
    // 使用 ProviderDiscoveryService 發現所有標記了 @Provider 裝飾器的提供者
    const discoveredProviders = this.discoveryService.discoverProviders();

    // 註冊發現的提供者
    for (const { blockchainType, providerType, providerClass } of discoveredProviders) {
      this.registerProvider(blockchainType, providerType, providerClass);
    }
  }

  /**
   * 註冊提供者
   * @param providers 提供者註冊列表
   */
  private registerProviders(providers: ProviderRegistration[]): void {
    for (const { blockchainType, providerType, providerClass } of providers) {
      this.registerProvider(blockchainType, providerType, providerClass);
    }
  }

  /**
   * 註冊單個提供者
   * @param blockchainType 區塊鏈類型
   * @param providerType 提供者類型
   * @param providerClass 提供者類
   */
  registerProvider(
    blockchainType: ChainName | string,
    providerType: ProviderType | string,
    providerClass: Type<BlockchainProviderInterface>,
  ): void {
    const blockchain = blockchainType.toString();
    const provider = providerType.toString();

    if (!this.providers.has(blockchain)) {
      this.providers.set(blockchain, new Map());
    }

    this.providers.get(blockchain)?.set(provider, providerClass);
  }

  /**
   * 獲取提供者實例
   * @param blockchainType 區塊鏈類型或代幣符號
   * @param providerType 提供者類型（可選，默認使用配置或映射）
   * @returns 提供者實例
   */
  getProvider(
    blockchainType: ChainName | string,
    providerType?: ProviderType | string,
  ): BlockchainProviderInterface {
    // 將代幣符號轉換為區塊鏈類型
    const blockchain = this.normalizeBlockchainType(blockchainType);

    // 如果未指定提供者類型，從配置或默認映射獲取
    const provider = providerType || this.getDefaultProviderType(blockchain);

    // 檢查是否已有實例緩存
    if (this.hasProviderInstance(blockchain, provider)) {
      const instance = this.getProviderInstance(blockchain, provider);
      if (instance) {
        return instance;
      }
    }

    // 獲取提供者類並創建實例
    const providerClass = this.getProviderClass(blockchain, provider);
    if (!providerClass) {
      throw new NotFoundException(`沒有找到區塊鏈類型 ${blockchain} 的提供者 ${provider}`);
    }

    const instance = this.moduleRef.get(providerClass, { strict: false });
    if (!instance) {
      throw new NotFoundException(`無法實例化提供者類 ${providerClass.name}`);
    }

    // 緩存實例
    this.setProviderInstance(blockchain, provider, instance);

    return instance;
  }

  /**
   * 獲取以太坊提供者
   * @param providerType 提供者類型
   * @returns 以太坊提供者實例
   */
  getEthereumProvider(providerType?: ProviderType | string): EthereumProviderInterface {
    return this.getProvider(ChainName.ETHEREUM, providerType) as EthereumProviderInterface;
  }

  /**
   * 獲取 Solana 提供者
   * @param providerType 提供者類型
   * @returns Solana 提供者實例
   */
  getSolanaProvider(providerType?: ProviderType | string): SolanaProviderInterface {
    return this.getProvider(ChainName.SOLANA, providerType) as SolanaProviderInterface;
  }

  /**
   * 獲取EVM链提供者
   * @param chainId 链ID
   * @param providerType 提供者類型
   * @returns EVM提供者實例
   */
  getEvmProvider(chainId: number, providerType?: ProviderType | string): EthereumProviderInterface {
    // 通過 chainId 反向映射到區塊鏈類型
    const blockchainType = this.getChainTypeFromChainId(chainId);

    if (!blockchainType) {
      throw new NotFoundException(`沒有找到 chainId ${chainId} 對應的區塊鏈類型`);
    }

    // 使用現有的 getProvider 方法獲取提供者
    return this.getProvider(blockchainType, providerType) as EthereumProviderInterface;
  }

  /**
   * 根據 chainId 獲取區塊鏈類型
   * @param chainId 鏈 ID
   * @returns 區塊鏈類型
   */
  private getChainTypeFromChainId(chainId: number): ChainName | null {
    // 遍歷 CHAIN_INFO_MAP 查找匹配的 chainId
    for (const [chainName, chainInfo] of Object.entries(CHAIN_INFO_MAP)) {
      if (chainInfo.id === chainId) {
        return chainName as ChainName;
      }
    }
    return null;
  }

  /**
   * 列出所有已註冊的提供者
   * @returns 提供者描述符列表
   */
  listProviders(): ProviderDescriptor[] {
    const result: ProviderDescriptor[] = [];

    this.providers.forEach((providerMap, blockchain) => {
      providerMap.forEach((_, provider) => {
        result.push(new ProviderDescriptor(blockchain as ChainName, provider as ProviderType));
      });
    });

    return result;
  }

  /**
   * 從配置或默認映射中獲取默認提供者類型
   * @param blockchainType 區塊鏈類型
   * @returns 提供者類型
   */
  private getDefaultProviderType(blockchainType: string): string {
    const configKey = `PROVIDER_${blockchainType.toUpperCase()}`;
    const fromConfig = this.configService.get<string>(configKey);

    if (fromConfig) {
      return fromConfig;
    }

    return CHAIN_TO_DEFAULT_PROVIDER_MAP[blockchainType as ChainName] || ProviderType.RPC;
  }

  /**
   * 標準化區塊鏈類型輸入
   * @param input 輸入（可以是區塊鏈類型或代幣符號）
   * @returns 標準化的區塊鏈類型
   */
  private normalizeBlockchainType(input: ChainName | string): string {
    const lowercaseInput = input.toString().toLowerCase();

    // 檢查是否為代幣符號
    if (COIN_SYMBOL_TO_CHAIN_MAP[lowercaseInput]) {
      return COIN_SYMBOL_TO_CHAIN_MAP[lowercaseInput];
    }

    return lowercaseInput;
  }

  /**
   * 獲取提供者類
   * @param blockchainType 區塊鏈類型
   * @param providerType 提供者類型
   * @returns 提供者類
   */
  private getProviderClass(
    blockchainType: string,
    providerType: string,
  ): Type<BlockchainProviderInterface> | undefined {
    return this.providers.get(blockchainType)?.get(providerType);
  }

  /**
   * 檢查是否已有提供者實例
   * @param blockchainType 區塊鏈類型
   * @param providerType 提供者類型
   * @returns 是否已有實例
   */
  private hasProviderInstance(blockchainType: string, providerType: string): boolean {
    return !!this.instances.get(blockchainType)?.has(providerType);
  }

  /**
   * 獲取提供者實例
   * @param blockchainType 區塊鏈類型
   * @param providerType 提供者類型
   * @returns 提供者實例
   */
  private getProviderInstance(
    blockchainType: string,
    providerType: string,
  ): BlockchainProviderInterface | undefined {
    return this.instances.get(blockchainType)?.get(providerType);
  }

  /**
   * 設置提供者實例
   * @param blockchainType 區塊鏈類型
   * @param providerType 提供者類型
   * @param instance 實例
   */
  private setProviderInstance(
    blockchainType: string,
    providerType: string,
    instance: BlockchainProviderInterface,
  ): void {
    if (!this.instances.has(blockchainType)) {
      this.instances.set(blockchainType, new Map());
    }

    this.instances.get(blockchainType)?.set(providerType, instance);
  }
}
