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
  // 可以在這裡添加更多的鏈
}

/**
 * 舊有的鏈類型定義 (兼容性)
 */
export enum SupportedChainType {
  ETH = 'eth',
  SOL = 'sol',
}

/**
 * 鏈信息介面
 */
export interface ChainInfo {
  id: number;
  name: string;
  type: ChainName;
  coinSymbols: string[]; // 添加代幣符號數組
}

/**
 * 支持的鏈信息列表
 */
export const SUPPORTED_CHAINS: ChainInfo[] = [
  {
    id: 1,
    name: 'Ethereum',
    type: ChainName.ETHEREUM,
    coinSymbols: ['eth', 'ethereum'], // 支持的代幣符號和別名
  },
  {
    id: 101,
    name: 'Solana',
    type: ChainName.SOLANA,
    coinSymbols: ['sol', 'solana'], // 支持的代幣符號和別名
  },
];

/**
 * 鏈信息映射表
 */
export const CHAIN_INFO_MAP = SUPPORTED_CHAINS.reduce(
  (map, chainInfo) => {
    map[chainInfo.type] = chainInfo;
    return map;
  },
  {} as Record<ChainName, ChainInfo>,
);

/**
 * 代幣符號到鏈名稱的映射表
 */
export const COIN_SYMBOL_TO_CHAIN_MAP = SUPPORTED_CHAINS.reduce(
  (map, chainInfo) => {
    // 將每個代幣符號映射到對應的鏈類型
    chainInfo.coinSymbols.forEach((symbol) => {
      map[symbol.toLowerCase()] = chainInfo.type;
    });
    // 同時添加原始鏈類型名稱作為鍵
    map[chainInfo.type.toLowerCase()] = chainInfo.type;
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
