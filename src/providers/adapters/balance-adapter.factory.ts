import { ChainName } from '../../chains/constants';
import { ProviderType } from '../constants/blockchain-types';
import { BalanceAdapter } from './balance-adapter.interface';
import { EvmBalanceAdapter } from './implementations/evm-balance.adapter';
import { SolanaBalanceAdapter } from './implementations/solana-balance.adapter';
import { EvmQuickNodeAdapter } from './implementations/evm-quicknode.adapter';

/**
 * 餘額適配器工廠 - 根據鏈類型和提供者類型創建對應的適配器
 */
export class BalanceAdapterFactory {
  // 適配器緩存
  private static adapters: Map<string, BalanceAdapter> = new Map();

  // EVM 鏈列表
  private static readonly EVM_CHAINS = [
    ChainName.ETHEREUM,
    ChainName.ETHEREUM_GOERLI,
    ChainName.ETHEREUM_SEPOLIA,
    ChainName.POLYGON,
    ChainName.POLYGON_MUMBAI,
    ChainName.BSC,
    ChainName.BSC_TESTNET,
  ];

  // Solana 鏈列表
  private static readonly SOLANA_CHAINS = [ChainName.SOLANA, ChainName.SOLANA_DEVNET];

  /**
   * 創建適配器的唯一標識
   * @param chainName 鏈名稱
   * @param providerType 提供者類型
   * @returns 唯一標識
   */
  private static getAdapterKey(chainName: ChainName, providerType?: ProviderType): string {
    return providerType ? `${chainName}:${providerType}` : chainName;
  }

  /**
   * 獲取特定鏈的餘額適配器（不指定提供者類型）
   * @param chainName 鏈名稱
   * @returns 對應的餘額適配器
   */
  public static forChain(chainName: ChainName): BalanceAdapter {
    return this.forProvider(chainName);
  }

  /**
   * 獲取特定鏈和提供者的餘額適配器
   * @param chainName 鏈名稱
   * @param providerType 提供者類型，如果不指定則使用預設適配器
   * @returns 對應的餘額適配器
   */
  public static forProvider(chainName: ChainName, providerType?: ProviderType): BalanceAdapter {
    const key = this.getAdapterKey(chainName, providerType);

    // 檢查緩存
    if (this.adapters.has(key)) {
      return this.adapters.get(key)!;
    }

    let adapter: BalanceAdapter;

    // 根據鏈類型和提供者類型創建適配器
    if (this.EVM_CHAINS.includes(chainName)) {
      if (providerType === ProviderType.QUICKNODE) {
        adapter = new EvmQuickNodeAdapter();
      } else {
        adapter = new EvmBalanceAdapter();
      }
    } else if (this.SOLANA_CHAINS.includes(chainName)) {
      adapter = new SolanaBalanceAdapter();
    } else {
      throw new Error(`No adapter available for chain: ${chainName}`);
    }

    // 儲存到緩存
    this.adapters.set(key, adapter);

    return adapter;
  }
}
