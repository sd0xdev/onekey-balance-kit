import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { SupportedChainType, CHAIN_INFO_MAP } from '../../chains/constants';

@Injectable()
export class BalanceService {
  constructor(private readonly cacheService: CacheService) {}

  async getPortfolio(chain: SupportedChainType, address: string) {
    // 1. 先从缓存获取
    const cacheKey = `portfolio:${chain}:${address}`;
    const cachedData = await this.cacheService.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // 2. 实际实现会在具体链的服务中完成，这里只是接口定义
    // 3. 设置缓存并返回数据
    // 实际实现时，这里会调用链特定的服务
    return {
      chainId: CHAIN_INFO_MAP[chain].id,
      native: {},
      fungibles: [],
      nfts: [],
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }
}
