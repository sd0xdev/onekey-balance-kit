/**
 * 裝飾器元數據鍵
 */
export const CHAIN_METADATA = 'chain';

/**
 * 定義所有支持的鏈名稱
 */
export enum ChainName {
  // 主網
  ETHEREUM = 'ethereum',
  SOLANA = 'solana',
  POLYGON = 'polygon',
  BSC = 'bsc',

  // 測試網
  ETHEREUM_GOERLI = 'ethereum_goerli',
  ETHEREUM_SEPOLIA = 'ethereum_sepolia',
  SOLANA_DEVNET = 'solana_devnet',
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
  isMainnet: boolean; // 標記是否為主網
  mainnetRef?: ChainName; // 如果是測試網，參照的主網名稱
  networkIdentifier?: string; // 外部服務識別符，如 'ETH_MAINNET', 'ETH_GOERLI'
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
  return [
    ChainName.ETHEREUM,
    ChainName.POLYGON,
    ChainName.BSC,
    ChainName.ETHEREUM_GOERLI,
    ChainName.ETHEREUM_SEPOLIA,
  ].includes(chainName);
}

/**
 * 支持的鏈信息映射表
 */
export const CHAIN_INFO_MAP: Record<ChainName, BaseChainInfo> = {
  // === 主網 ===
  [ChainName.ETHEREUM]: {
    id: 1,
    name: ChainName.ETHEREUM,
    display: 'Ethereum',
    coinSymbols: ['eth', 'ethereum'],
    isMainnet: true,
    networkIdentifier: 'ETH_MAINNET',
  },
  [ChainName.SOLANA]: {
    id: 101,
    name: ChainName.SOLANA,
    display: 'Solana',
    coinSymbols: ['sol', 'solana'],
    isMainnet: true,
    networkIdentifier: 'SOL_MAINNET',
  },
  [ChainName.POLYGON]: {
    id: 137,
    name: ChainName.POLYGON,
    display: 'Polygon',
    coinSymbols: ['poly', 'matic', 'polygon'],
    isMainnet: true,
    networkIdentifier: 'POLY_MAINNET',
  },
  [ChainName.BSC]: {
    id: 56,
    name: ChainName.BSC,
    display: 'BNB Smart Chain',
    coinSymbols: ['bsc', 'bnb'],
    isMainnet: true,
    networkIdentifier: 'BSC_MAINNET',
  },

  // === 測試網 ===
  [ChainName.ETHEREUM_GOERLI]: {
    id: 5,
    name: ChainName.ETHEREUM_GOERLI,
    display: 'Ethereum Goerli',
    coinSymbols: ['eth', 'ethereum', 'goerli'],
    isMainnet: false,
    mainnetRef: ChainName.ETHEREUM,
    networkIdentifier: 'ETH_GOERLI',
  },
  [ChainName.ETHEREUM_SEPOLIA]: {
    id: 11155111,
    name: ChainName.ETHEREUM_SEPOLIA,
    display: 'Ethereum Sepolia',
    coinSymbols: ['eth', 'ethereum', 'sepolia'],
    isMainnet: false,
    mainnetRef: ChainName.ETHEREUM,
    networkIdentifier: 'ETH_SEPOLIA',
  },
  [ChainName.SOLANA_DEVNET]: {
    id: 103,
    name: ChainName.SOLANA_DEVNET,
    display: 'Solana Devnet',
    coinSymbols: ['sol', 'solana', 'devnet'],
    isMainnet: false,
    mainnetRef: ChainName.SOLANA,
    networkIdentifier: 'SOL_DEVNET',
  },
};

/**
 * 網絡標識符到鏈名稱的映射
 */
export const NETWORK_ID_TO_CHAIN_MAP = Object.values(CHAIN_INFO_MAP).reduce(
  (map, chainInfo) => {
    if (chainInfo.networkIdentifier) {
      map[chainInfo.networkIdentifier] = chainInfo.name;
    }
    return map;
  },
  {} as Record<string, ChainName>,
);

/**
 * 取得鏈ID的輔助函數
 */
export function getChainId(chainName: ChainName): number | null {
  return CHAIN_INFO_MAP[chainName]?.id || null;
}

/**
 * 根據網絡標識符獲取鏈ID
 */
export function getChainIdFromNetworkId(networkId: string): number | null {
  const chainName = NETWORK_ID_TO_CHAIN_MAP[networkId];
  return chainName ? CHAIN_INFO_MAP[chainName].id : null;
}

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
  [ChainName.ETHEREUM_GOERLI]: {
    ...CHAIN_INFO_MAP[ChainName.ETHEREUM_GOERLI],
    symbol: 'ETH',
    decimals: 18,
  },
  [ChainName.ETHEREUM_SEPOLIA]: {
    ...CHAIN_INFO_MAP[ChainName.ETHEREUM_SEPOLIA],
    symbol: 'ETH',
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
    // 只為主網添加代幣符號映射，避免測試網衝突
    if (chainInfo.isMainnet) {
      // 將每個代幣符號映射到對應的鏈類型
      chainInfo.coinSymbols.forEach((symbol) => {
        map[symbol.toLowerCase()] = chainInfo.name;
      });
      // 同時添加原始鏈類型名稱作為鍵
      map[chainInfo.name.toLowerCase()] = chainInfo.name;
    }
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
