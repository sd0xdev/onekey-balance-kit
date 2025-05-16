import { Injectable, Logger } from '@nestjs/common';
import { ChainName, CHAIN_INFO_MAP } from '../../chains/constants';
import { ProviderType } from '../../providers/constants/blockchain-types';
import { CacheService } from './cache.service';

export enum CacheKeyPrefix {
  PORTFOLIO = 'portfolio',
  TRANSACTION = 'transaction',
  NFT = 'nft',
  PRICE = 'price',
}

export interface CacheKeyComponents {
  prefix: CacheKeyPrefix;
  chain: ChainName;
  chainId?: number;
  address?: string;
  provider?: ProviderType;
  extra?: string[];
}

@Injectable()
export class CacheKeyService {
  private readonly logger = new Logger(CacheKeyService.name);
  private readonly DELIMITER = ':';

  constructor(private readonly cacheService: CacheService) {}

  /**
   * 生成緩存鍵
   * @param components 緩存鍵組件
   * @returns 格式化的緩存鍵
   */
  generateKey(components: CacheKeyComponents): string {
    const { prefix, chain, chainId, address, provider, extra = [] } = components;

    // 獲取鏈ID，如果未提供則從CHAIN_INFO_MAP中獲取
    const resolvedChainId = chainId || CHAIN_INFO_MAP[chain]?.id;

    // 構建鍵組件數組，指定為字串陣列類型
    const keyParts: string[] = [prefix, chain];

    // 如果有鏈ID，添加到鍵中
    if (resolvedChainId) {
      keyParts.push(String(resolvedChainId));
    }

    // 如果有地址，添加到鍵中
    if (address) {
      keyParts.push(address);
    }

    // 如果有提供者，添加到鍵中
    if (provider) {
      keyParts.push(provider);
    }

    // 添加額外組件
    if (extra.length > 0) {
      keyParts.push(...extra);
    }

    // 使用分隔符連接所有組件
    return keyParts.join(this.DELIMITER);
  }

  /**
   * 解析緩存鍵為組件
   * @param key 緩存鍵
   * @returns 解析的緩存鍵組件
   */
  parseKey(key: string): Partial<CacheKeyComponents> {
    const parts = key.split(this.DELIMITER);

    if (parts.length < 2) {
      this.logger.warn(`Invalid cache key format: ${key}`);
      return {};
    }

    const prefix = parts[0] as CacheKeyPrefix;
    const chain = parts[1] as ChainName;

    // 基礎組件
    const components: Partial<CacheKeyComponents> = {
      prefix,
      chain,
    };

    if (parts.length <= 2) {
      return components; // 如果只有兩個部分，則沒有鏈ID、地址和提供者
    }

    // 解析鏈ID (如果存在)
    const possibleChainId = Number(parts[2]);
    const isNumeric = !isNaN(possibleChainId) && String(possibleChainId) === parts[2];

    let currentIndex = 2; // 初始化索引為2

    // 如果有鏈ID，添加到組件中
    if (isNumeric) {
      components.chainId = possibleChainId;
      currentIndex++;
    }

    // 如果有地址，添加到組件中
    if (currentIndex < parts.length) {
      components.address = parts[currentIndex];
      currentIndex++;
    }

    // 如果有提供者，添加到組件中
    if (currentIndex < parts.length) {
      // 檢查是否為有效的提供者類型
      const providerValue = parts[currentIndex];
      const isValidProvider = Object.values(ProviderType).some(
        (value) => value.toLowerCase() === providerValue.toLowerCase(),
      );

      if (isValidProvider) {
        components.provider = providerValue as ProviderType;
        currentIndex++;
      }
    }

    // 剩餘部分作為額外數據
    if (currentIndex < parts.length) {
      components.extra = parts.slice(currentIndex);
    }

    return components;
  }

  /**
   * 創建投資組合緩存鍵
   * @param chain 鏈名稱
   * @param address 地址
   * @param provider 提供者類型 (可選)
   * @returns 格式化的緩存鍵
   */
  createPortfolioKey(chain: ChainName, address: string, provider?: ProviderType): string {
    return this.generateKey({
      prefix: CacheKeyPrefix.PORTFOLIO,
      chain,
      address,
      provider,
    });
  }

  /**
   * 刪除與特定地址相關的所有緩存
   * @param chain 鏈名稱
   * @param address 地址
   * @returns 已刪除的緩存數量
   */
  async invalidateAddressCache(chain: ChainName, address: string): Promise<number> {
    const pattern = `${CacheKeyPrefix.PORTFOLIO}:${chain}:*:${address}*`;
    this.logger.debug(`Invalidating cache with pattern: ${pattern}`);
    return this.cacheService.deleteByPattern(pattern);
  }

  /**
   * 刪除與特定鏈上特定地址相關的所有緩存
   * @param chain 鏈名稱
   * @param chainId 鏈ID
   * @param address 地址
   * @returns 已刪除的緩存數量
   */
  async invalidateChainAddressCache(
    chain: ChainName,
    chainId: number,
    address: string,
  ): Promise<number> {
    const pattern = `${CacheKeyPrefix.PORTFOLIO}:${chain}:${chainId}:${address}*`;
    this.logger.debug(`Invalidating chain address cache with pattern: ${pattern}`);
    return this.cacheService.deleteByPattern(pattern);
  }

  /**
   * 刪除與特定提供者相關的所有緩存
   * @param provider 提供者類型
   * @returns 已刪除的緩存數量
   */
  async invalidateProviderCache(provider: ProviderType): Promise<number> {
    const pattern = `*:*:*:*:${provider}`;
    this.logger.debug(`Invalidating provider cache with pattern: ${pattern}`);
    return this.cacheService.deleteByPattern(pattern);
  }
}
