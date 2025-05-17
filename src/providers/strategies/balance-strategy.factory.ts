import { ChainName } from '../../chains/constants';
import { ProviderType } from '../constants/blockchain-types';
import { BalanceStrategy } from './balance-strategy.interface';
import { EvmAlchemyStrategy } from './implementations/evm-alchemy.strategy';
import { SolanaAlchemyStrategy } from './implementations/solana-alchemy.strategy';
import { Alchemy, Network } from 'alchemy-sdk';

/**
 * 餘額策略工廠 - 用於創建對應的策略實例
 */
export class BalanceStrategyFactory {
  // 策略緩存
  private static strategies: Map<string, BalanceStrategy> = new Map();

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
   * 創建策略的唯一標識
   * @param chainName 鏈名稱
   * @param providerType 提供者類型
   * @returns 唯一標識
   */
  private static getStrategyKey(chainName: ChainName, providerType: ProviderType): string {
    return `${chainName}:${providerType}`;
  }

  /**
   * 創建 Alchemy 策略
   * @param chainName 鏈名稱
   * @param apiKey API 金鑰
   * @param network Alchemy 網絡配置
   * @returns 對應的策略實例
   */
  public static createAlchemyStrategy(
    chainName: ChainName,
    apiKey: string,
    network?: Network,
  ): BalanceStrategy {
    const key = this.getStrategyKey(chainName, ProviderType.ALCHEMY);

    // 檢查緩存
    if (this.strategies.has(key)) {
      return this.strategies.get(key)!;
    }

    let strategy: BalanceStrategy;

    // 根據鏈類型創建策略
    if (this.EVM_CHAINS.includes(chainName)) {
      if (!network) {
        throw new Error(`Network configuration is required for EVM chain: ${chainName}`);
      }
      const client = new Alchemy({
        apiKey,
        network,
      });
      strategy = new EvmAlchemyStrategy(client);
    } else if (this.SOLANA_CHAINS.includes(chainName)) {
      const isDevnet = chainName === ChainName.SOLANA_DEVNET;
      strategy = new SolanaAlchemyStrategy(apiKey, isDevnet);
    } else {
      throw new Error(`Unsupported chain: ${chainName}`);
    }

    // 儲存到緩存
    this.strategies.set(key, strategy);

    return strategy;
  }

  /**
   * 獲取特定鏈和提供者的策略
   * @param chainName 鏈名稱
   * @param providerType 提供者類型
   * @returns 對應的策略實例，如果不存在則返回 undefined
   */
  public static getStrategy(
    chainName: ChainName,
    providerType: ProviderType,
  ): BalanceStrategy | undefined {
    const key = this.getStrategyKey(chainName, providerType);
    return this.strategies.get(key);
  }

  /**
   * 設定策略
   * @param chainName 鏈名稱
   * @param providerType 提供者類型
   * @param strategy 策略實例
   */
  public static setStrategy(
    chainName: ChainName,
    providerType: ProviderType,
    strategy: BalanceStrategy,
  ): void {
    const key = this.getStrategyKey(chainName, providerType);
    this.strategies.set(key, strategy);
  }

  /**
   * 清除策略緩存
   */
  public static clearStrategies(): void {
    this.strategies.clear();
  }
}
