import { SetMetadata } from '@nestjs/common';
import { CHAIN_METADATA } from '../constants/index';

/**
 * 全局鏈服務映射，保存鏈名稱到服務類的映射
 */
export const GLOBAL_CHAIN_SERVICE_MAP = new Map<string, any>();

/**
 * 鏈元數據介面
 */
export interface ChainMeta {
  mainnet: string;
  testnets: Set<string>;
}

/**
 * Chain 裝飾器
 * 用於標記鏈服務，支援主網和測試網的多參數
 * @param mainnet 主網鏈名稱
 * @param testnets 測試網鏈名稱列表
 */
export const Chain = (mainnet: string, ...testnets: string[]): ClassDecorator => {
  const all = [mainnet, ...testnets];
  return (target) => {
    Reflect.defineMetadata(CHAIN_METADATA, { mainnet, testnets: new Set(testnets) }, target);
    // 便於反向索引
    all.forEach((c) => GLOBAL_CHAIN_SERVICE_MAP.set(c, target));
  };
};
