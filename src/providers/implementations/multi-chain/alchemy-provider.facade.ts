import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Alchemy, Network } from 'alchemy-sdk';
import { AbstractProviderService } from '../../abstract/abstract-provider.service';
import { BalancesResponse, NetworkType } from '../../interfaces/blockchain-provider.interface';
import { EthereumTransactionRequest } from '../../interfaces/evm-provider.interface';
import { ProviderType } from '../../constants/blockchain-types';
import { Provider } from '../../decorators/provider.decorator';
import { ChainName } from '../../../chains/constants';
import { ConfigKey } from '../../../config/constants';
import { BalanceStrategy } from '../../strategies/balance-strategy.interface';
import { EvmAlchemyStrategy } from '../../strategies/implementations/evm-alchemy.strategy';
import { SolanaAlchemyStrategy } from '../../strategies/implementations/solana-alchemy.strategy';
import { BalanceAdapterFactory } from '../../adapters/balance-adapter.factory';

// 定義 Alchemy 網絡映射
const ALCHEMY_NETWORK_MAP: Record<ChainName, Network | undefined> = {
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

// 定義每條鏈的環境變數前綴
const ENV_PREFIX_MAP: Record<ChainName, string | undefined> = {
  [ChainName.ETHEREUM]: 'ETH',
  [ChainName.ETHEREUM_GOERLI]: 'ETH',
  [ChainName.ETHEREUM_SEPOLIA]: 'ETH',
  [ChainName.POLYGON]: 'POLYGON',
  [ChainName.POLYGON_MUMBAI]: 'POLYGON',
  [ChainName.BSC]: 'BSC',
  [ChainName.BSC_TESTNET]: 'BSC',
  [ChainName.SOLANA]: 'SOLANA',
  [ChainName.SOLANA_DEVNET]: 'SOLANA',
};

// 支援的 Alchemy 鏈列表
const SUPPORTED_ALCHEMY_CHAINS = [
  ChainName.ETHEREUM,
  ChainName.ETHEREUM_GOERLI,
  ChainName.ETHEREUM_SEPOLIA,
  ChainName.POLYGON,
  ChainName.POLYGON_MUMBAI,
  ChainName.BSC,
  ChainName.BSC_TESTNET,
  ChainName.SOLANA,
  ChainName.SOLANA_DEVNET,
];

// EVM 鏈列表
const EVM_CHAINS = [
  ChainName.ETHEREUM,
  ChainName.ETHEREUM_GOERLI,
  ChainName.ETHEREUM_SEPOLIA,
  ChainName.POLYGON,
  ChainName.POLYGON_MUMBAI,
  ChainName.BSC,
  ChainName.BSC_TESTNET,
];

// Solana 鏈列表
const SOLANA_CHAINS = [ChainName.SOLANA, ChainName.SOLANA_DEVNET];

/**
 * Alchemy 提供者門面 - 使用策略模式和適配器模式實現多鏈支援
 */
@Provider({
  blockchainType: SUPPORTED_ALCHEMY_CHAINS,
  providerType: ProviderType.ALCHEMY,
})
@Injectable()
export class AlchemyProviderFacade extends AbstractProviderService implements OnModuleInit {
  private strategies: Map<ChainName, BalanceStrategy> = new Map();
  private defaultChain: ChainName = ChainName.ETHEREUM;
  private globalAlchemyApiKey: string | undefined;
  protected supportedChains: ChainName[] = [];

  constructor(private readonly configService: ConfigService) {
    super();
    this.initSupportedChains(SUPPORTED_ALCHEMY_CHAINS);

    // 獲取全局 Alchemy API Key
    this.globalAlchemyApiKey =
      this.configService.get<string>(`${ConfigKey.Blockchain}.alchemyApiKey`) ||
      this.configService.get<string>('ALCHEMY_API_KEY') ||
      '';

    // 根據配置選擇默認鏈
    const configDefaultChain = this.configService.get<string>('ALCHEMY_DEFAULT_CHAIN');
    if (configDefaultChain && SUPPORTED_ALCHEMY_CHAINS.includes(configDefaultChain as ChainName)) {
      this.defaultChain = configDefaultChain as ChainName;
      this.logInfo(`Set default chain to ${this.defaultChain}`);
    }
  }

  /**
   * 初始化支援的鏈
   * @param chains 支援的鏈列表
   */
  protected initSupportedChains(chains: ChainName[]): void {
    this.supportedChains = [...chains];
    this.logInfo(`Initialized supported chains: ${this.supportedChains.join(', ')}`);
  }

  /**
   * 在模組初始化時設置策略
   */
  onModuleInit() {
    this.initializeStrategies();
  }

  /**
   * 初始化所有支援鏈的策略
   */
  private initializeStrategies(): void {
    let initializedCount = 0;

    // 為每個支援的鏈創建策略
    for (const chainName of this.supportedChains) {
      try {
        // 獲取網路類型
        const networkType = this.isTestnet(chainName) ? NetworkType.TESTNET : NetworkType.MAINNET;

        // 獲取 API 金鑰
        const apiKey = this.getApiKey(networkType.toString(), chainName);
        const finalApiKey = apiKey || this.globalAlchemyApiKey;

        if (!finalApiKey) {
          this.logWarning(`API key not configured for ${chainName}`);
          continue;
        }

        // 根據鏈類型創建適當的策略
        if (EVM_CHAINS.includes(chainName)) {
          // EVM 鏈策略
          const networkValue = ALCHEMY_NETWORK_MAP[chainName];

          if (!networkValue) {
            this.logWarning(`Chain ${chainName} is not supported by Alchemy for EVM`);
            continue;
          }

          // 創建 Alchemy SDK 客戶端
          const client = new Alchemy({
            apiKey: finalApiKey,
            network: networkValue,
          });

          // 創建並儲存 EVM 策略
          this.strategies.set(chainName, new EvmAlchemyStrategy(client));
          this.logInfo(`Initialized EVM Alchemy strategy for ${chainName}`);
          initializedCount++;
        } else if (SOLANA_CHAINS.includes(chainName)) {
          // Solana 鏈策略
          const isDevnet = chainName === ChainName.SOLANA_DEVNET;

          // 創建並儲存 Solana 策略
          this.strategies.set(chainName, new SolanaAlchemyStrategy(finalApiKey, isDevnet));
          this.logInfo(`Initialized Solana Alchemy strategy for ${chainName}`);
          initializedCount++;
        } else {
          this.logWarning(`Chain ${chainName} is not supported`);
        }
      } catch (error) {
        this.logError(`Failed to initialize strategy for ${chainName}: ${error}`);
      }
    }

    if (initializedCount === 0) {
      this.logWarning(
        'No Alchemy strategies were initialized. Provider may not function correctly.',
      );
    } else {
      this.logInfo(`Initialized ${initializedCount} strategies successfully`);
    }
  }

  /**
   * 判斷鏈是否為測試網
   */
  private isTestnet(chainName: ChainName): boolean {
    return chainName.includes('_') || chainName.includes('testnet') || chainName.includes('devnet');
  }

  /**
   * 獲取適當的鏈名稱
   * 如果未提供則返回默認鏈
   */
  private getChainName(
    networkType: NetworkType = NetworkType.MAINNET,
    chainName?: ChainName,
  ): ChainName {
    // 如果提供了鏈名稱且支援該鏈，則使用它
    if (chainName && this.supportedChains.includes(chainName)) {
      this.logInfo(`使用指定鏈名稱: ${chainName}`);
      return chainName;
    }

    // 否則根據網絡類型選擇默認鏈
    if (networkType === NetworkType.TESTNET) {
      // 找到一個支援的測試網
      const testnet = this.supportedChains.find((chain) => this.isTestnet(chain));
      const selectedTestnet = testnet || ChainName.ETHEREUM_SEPOLIA;
      this.logInfo(`使用測試網: ${selectedTestnet}`);
      return selectedTestnet;
    }

    // 返回主網默認鏈
    this.logInfo(`使用默認主網鏈: ${this.defaultChain}`);
    return this.defaultChain;
  }

  /**
   * 獲取指定鏈的策略
   */
  private getStrategy(
    networkType: NetworkType = NetworkType.MAINNET,
    chainName?: ChainName,
  ): BalanceStrategy {
    const resolvedChainName = this.getChainName(networkType, chainName);

    const strategy = this.strategies.get(resolvedChainName);
    if (!strategy) {
      this.logError(`無法獲取 ${resolvedChainName} 的 Alchemy 策略，請檢查 API 金鑰配置`);
      throw new Error(
        `No Alchemy strategy initialized for ${resolvedChainName}. Please check API key configuration.`,
      );
    }

    this.logInfo(`取得 ${resolvedChainName} 的 Alchemy 策略`);
    return strategy;
  }

  /**
   * 獲取提供者名稱
   */
  getProviderName(): string {
    return 'Alchemy';
  }

  /**
   * 檢查提供者是否支援
   */
  isSupported(): boolean {
    return this.strategies.size > 0;
  }

  /**
   * 獲取 Alchemy API 的基礎 URL
   */
  getBaseUrl(networkType: string = NetworkType.MAINNET.toString(), chainName?: ChainName): string {
    const resolvedChainName = this.getChainName(networkType as NetworkType, chainName);

    // 根據鏈名構建合適的基礎 URL
    const networkValue = ALCHEMY_NETWORK_MAP[resolvedChainName];
    let network = 'ethereum-mainnet';

    if (networkValue) {
      network = networkValue.toLowerCase();
    }

    return `https://${network}.g.alchemy.com/v2/`;
  }

  /**
   * 獲取 Alchemy API 密鑰
   */
  getApiKey(networkType: string = NetworkType.MAINNET.toString(), chainName?: ChainName): string {
    const resolvedChainName = this.getChainName(networkType as NetworkType, chainName);

    const prefix = ENV_PREFIX_MAP[resolvedChainName] || 'ETH';
    const isTestnet = this.isTestnet(resolvedChainName);

    // 構建環境變數名稱
    const keyEnvVar = isTestnet
      ? `ALCHEMY_API_KEY_${prefix}_TESTNET`
      : `ALCHEMY_API_KEY_${prefix}_MAINNET`;

    const fallbackKeyEnvVar = `ALCHEMY_API_KEY_${prefix}`;
    const defaultGlobalKey = this.configService.get<string>('ALCHEMY_API_KEY');

    // 嘗試按優先順序獲取 API Key：特定鏈 -> 通用前綴 -> 全局配置 -> 默認環境變數
    const apiKey =
      this.configService.get<string>(keyEnvVar) ||
      this.configService.get<string>(fallbackKeyEnvVar) ||
      this.globalAlchemyApiKey ||
      defaultGlobalKey ||
      '';

    if (apiKey) {
      this.logInfo(`使用 API 金鑰: ${keyEnvVar} 或 ${fallbackKeyEnvVar} 或全局金鑰`);
    } else {
      this.logWarning(
        `無法找到 ${resolvedChainName} 的 API 金鑰，請配置 ${keyEnvVar}、${fallbackKeyEnvVar} 或 ALCHEMY_API_KEY`,
      );
    }

    return apiKey;
  }

  /**
   * 獲取地址的餘額資訊
   */
  async getBalances(
    address: string,
    networkType: NetworkType = NetworkType.MAINNET,
    chainName?: ChainName,
  ): Promise<BalancesResponse> {
    try {
      const resolvedChainName = this.getChainName(networkType, chainName);

      this.logInfo(
        `Getting balances for ${address} using Alchemy provider on ${resolvedChainName} network`,
      );

      // 獲取適用於此鏈的策略
      const strategy = this.getStrategy(networkType, resolvedChainName);

      // 獲取原始餘額資料
      const rawBalances = await strategy.getRawBalances(address, networkType);

      // 使用適配器轉換為統一格式
      const adapter = BalanceAdapterFactory.forChain(resolvedChainName);
      return adapter.toBalancesResponse(rawBalances);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get balances from Alchemy: ${errorMessage}`);

      // 拋出錯誤，讓調用者可以處理
      throw new Error(`Alchemy provider error: ${errorMessage}`);
    }
  }

  /**
   * 獲取 Gas 價格
   */
  async getGasPrice(
    networkType: NetworkType = NetworkType.MAINNET,
    chainName?: ChainName,
  ): Promise<string> {
    try {
      const resolvedChainName = this.getChainName(networkType, chainName);

      // 獲取適用於此鏈的策略
      const strategy = this.getStrategy(networkType, resolvedChainName);

      // 獲取原始 Gas 價格資料
      const rawGasPrice = await strategy.getRawGasPrice(networkType);

      // 使用適配器轉換為統一格式
      const adapter = BalanceAdapterFactory.forChain(resolvedChainName);
      return adapter.toGasPrice(rawGasPrice);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get gas price: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 估算交易所需 Gas
   */
  async estimateGas(
    txData: EthereumTransactionRequest,
    networkType: NetworkType = NetworkType.MAINNET,
    chainName?: ChainName,
  ): Promise<string> {
    try {
      const resolvedChainName = this.getChainName(networkType, chainName);

      // 獲取適用於此鏈的策略
      const strategy = this.getStrategy(networkType, resolvedChainName);

      // 獲取原始 Gas 估算資料
      const rawEstimateGas = await strategy.getRawEstimateGas(txData, networkType);

      // 使用適配器轉換為統一格式
      const adapter = BalanceAdapterFactory.forChain(resolvedChainName);
      return adapter.toEstimateGas(rawEstimateGas);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to estimate gas: ${errorMessage}`);
      throw error;
    }
  }
}
