import { ChainName } from '../../chains/constants';
import { BalanceAdapter } from './balance-adapter.interface';
import { EvmBalanceAdapter } from './implementations/evm-balance.adapter';
import { SolanaBalanceAdapter } from './implementations/solana-balance.adapter';

/**
 * 餘額適配器工廠 - 根據鏈類型創建對應的適配器
 */
export class BalanceAdapterFactory {
  // 適配器緩存
  private static adapters: Map<ChainName, BalanceAdapter> = new Map();

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
   * 獲取特定鏈的餘額適配器
   * @param chainName 鏈名稱
   * @returns 對應的餘額適配器
   */
  public static forChain(chainName: ChainName): BalanceAdapter {
    // 檢查緩存
    if (this.adapters.has(chainName)) {
      return this.adapters.get(chainName)!;
    }

    let adapter: BalanceAdapter;

    // 根據鏈類型創建適配器
    if (this.EVM_CHAINS.includes(chainName)) {
      adapter = new EvmBalanceAdapter();
    } else if (this.SOLANA_CHAINS.includes(chainName)) {
      adapter = new SolanaBalanceAdapter();
    } else {
      throw new Error(`No adapter available for chain: ${chainName}`);
    }

    // 儲存到緩存
    this.adapters.set(chainName, adapter);

    return adapter;
  }
}
