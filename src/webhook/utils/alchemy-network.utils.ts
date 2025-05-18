import { ChainName, NETWORK_ID_TO_CHAIN_MAP } from '../../chains/constants';
import { Network } from 'alchemy-sdk';

/**
 * Alchemy 網絡 ID 到 ChainName 的雙向映射工具類
 */
export class AlchemyNetworkUtils {
  /**
   * 從 ChainName 獲取 Alchemy SDK Network 枚舉值
   * @param chain 區塊鏈名稱
   * @returns Alchemy 網絡枚舉值或 null
   */
  static getAlchemyNetworkForChain(chain: ChainName): Network | null {
    const networkMapping: Partial<Record<ChainName, Network>> = {
      [ChainName.ETHEREUM]: Network.ETH_MAINNET,
      [ChainName.ETHEREUM_GOERLI]: Network.ETH_GOERLI,
      [ChainName.ETHEREUM_SEPOLIA]: Network.ETH_SEPOLIA,
      [ChainName.POLYGON]: Network.MATIC_MAINNET,
      [ChainName.POLYGON_MUMBAI]: Network.MATIC_MUMBAI,
      [ChainName.BSC]: Network.BNB_MAINNET,
      [ChainName.BSC_TESTNET]: Network.BNB_TESTNET,
      [ChainName.SOLANA]: Network.SOLANA_MAINNET,
      [ChainName.SOLANA_DEVNET]: Network.SOLANA_DEVNET,
    };

    return networkMapping[chain] || null;
  }

  /**
   * 從 Alchemy 網絡 ID 字符串獲取 ChainName
   * @param networkId Alchemy 網絡 ID 字符串 (例如 'ETH_MAINNET')
   * @returns ChainName 或 null
   */
  static getChainNameFromNetworkId(networkId: string): ChainName | null {
    // 使用現有的 NETWORK_ID_TO_CHAIN_MAP 常量
    return NETWORK_ID_TO_CHAIN_MAP[networkId] || null;
  }

  /**
   * 從 ChainName 獲取 Alchemy 網絡 ID 字符串
   * @param chain 區塊鏈名稱
   * @returns Alchemy 網絡 ID 字符串 (例如 'ETH_MAINNET') 或 null
   */
  static getNetworkIdForChain(chain: ChainName): string | null {
    const networkIdMapping: Partial<Record<ChainName, string>> = {
      [ChainName.ETHEREUM]: 'ETH_MAINNET',
      [ChainName.ETHEREUM_GOERLI]: 'ETH_GOERLI',
      [ChainName.ETHEREUM_SEPOLIA]: 'ETH_SEPOLIA',
      [ChainName.POLYGON]: 'MATIC_MAINNET',
      [ChainName.POLYGON_MUMBAI]: 'MATIC_MUMBAI',
      [ChainName.BSC]: 'BNB_MAINNET',
      [ChainName.BSC_TESTNET]: 'BNB_TESTNET',
      [ChainName.SOLANA]: 'SOLANA_MAINNET',
      [ChainName.SOLANA_DEVNET]: 'SOLANA_DEVNET',
    };

    return networkIdMapping[chain] || null;
  }
}
