import { SetMetadata } from '@nestjs/common';

export const BLOCKCHAIN_PROVIDER_KEY = 'blockchain-provider';

/**
 * 指定區塊鏈提供者裝飾器
 *
 * 用於標記控制器或方法應該使用的區塊鏈提供者
 * @param provider 提供者名稱
 * @returns 裝飾器
 */
export const UseBlockchainProvider = (provider?: string) =>
  SetMetadata(BLOCKCHAIN_PROVIDER_KEY, provider);
