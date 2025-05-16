/**
 * 裝飾器元數據鍵
 */
export const CHAIN_METADATA = 'chain';

/**
 * 定義所有支持的鏈名稱
 */
export enum ChainName {
  ETHEREUM = 'ethereum',
  SOLANA = 'solana',
  POLYGON = 'polygon',
  BSC = 'bsc',
  // 可以在這裡添加更多的鏈
}

/**
 * 舊有的鏈類型定義 (兼容性)
 * 使用簡短代碼標識不同鏈
 */
export enum ChainCode {
  ETH = 'eth',
  SOL = 'sol',
  POLY = 'poly',
  BSC = 'bsc',
}

/**
 * 基礎鏈信息介面
 */
export interface BaseChainInfo {
  id: number;
  name: ChainName;
  display: string;
  coinSymbols: string[]; // 代幣符號和別名陣列
}

/**
 * EVM 鏈特有資訊
 */
export interface EvmChainInfo extends BaseChainInfo {
  symbol: string; // 主幣符號 (如 'ETH', 'MATIC')
  decimals: number; // 主幣小數位 (通常為 18)
}

/**
 * 判斷鏈是否為 EVM 鏈
 */
export function isEvmChain(chainName: ChainName): boolean {
  return [ChainName.ETHEREUM, ChainName.POLYGON, ChainName.BSC].includes(chainName);
}

/**
 * 支持的鏈信息映射表
 */
export const CHAIN_INFO_MAP: Record<ChainName, BaseChainInfo> = {
  [ChainName.ETHEREUM]: {
    id: 1,
    name: ChainName.ETHEREUM,
    display: 'Ethereum',
    coinSymbols: ['eth', 'ethereum'],
  },
  [ChainName.SOLANA]: {
    id: 101,
    name: ChainName.SOLANA,
    display: 'Solana',
    coinSymbols: ['sol', 'solana'],
  },
  [ChainName.POLYGON]: {
    id: 137,
    name: ChainName.POLYGON,
    display: 'Polygon',
    coinSymbols: ['poly', 'matic', 'polygon'],
  },
  [ChainName.BSC]: {
    id: 56,
    name: ChainName.BSC,
    display: 'BNB Smart Chain',
    coinSymbols: ['bsc', 'bnb'],
  },
};

/**
 * EVM 鏈特有資訊映射表
 * 只包含 EVM 鏈，故採用部分映射
 */
export const EVM_CHAIN_INFO_MAP: Partial<Record<ChainName, EvmChainInfo>> = {
  [ChainName.ETHEREUM]: {
    ...CHAIN_INFO_MAP[ChainName.ETHEREUM],
    symbol: 'ETH',
    decimals: 18,
  },
  [ChainName.POLYGON]: {
    ...CHAIN_INFO_MAP[ChainName.POLYGON],
    symbol: 'MATIC',
    decimals: 18,
  },
  [ChainName.BSC]: {
    ...CHAIN_INFO_MAP[ChainName.BSC],
    symbol: 'BNB',
    decimals: 18,
  },
};

/**
 * 支持的 EVM 鏈代碼映射
 * 只包含 EVM 鏈的代碼映射，故採用部分映射
 */
export const EVM_CHAIN_CODES: Partial<Record<ChainCode, ChainName>> = {
  [ChainCode.ETH]: ChainName.ETHEREUM,
  [ChainCode.POLY]: ChainName.POLYGON,
  [ChainCode.BSC]: ChainName.BSC,
};

/**
 * 代幣符號到鏈名稱的映射表
 */
export const COIN_SYMBOL_TO_CHAIN_MAP = Object.values(CHAIN_INFO_MAP).reduce(
  (map, chainInfo) => {
    // 將每個代幣符號映射到對應的鏈類型
    chainInfo.coinSymbols.forEach((symbol) => {
      map[symbol.toLowerCase()] = chainInfo.name;
    });
    // 同時添加原始鏈類型名稱作為鍵
    map[chainInfo.name.toLowerCase()] = chainInfo.name;
    return map;
  },
  {} as Record<string, ChainName>,
);

/**
 * 定義API路徑常量
 */
export const API_PATHS = {
  CHAINS: 'chains',
  VALIDATE_ADDRESS: ':chain/validate/:address',
  TRANSACTIONS: ':chain/transactions/:address',
  TRANSACTION_DETAILS: ':chain/transaction/:hash',
};
