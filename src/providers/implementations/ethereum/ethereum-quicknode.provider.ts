import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AbstractEthereumProviderService } from '../../abstract/abstract-ethereum-provider.service';
import { BalancesResponse, NetworkType } from '../../interfaces/blockchain-provider.interface';
import { EthereumTransactionRequest } from '../../interfaces/ethereum-provider.interface';
import { ChainName } from '../../../chains/constants';
import { ProviderType } from '../../constants/blockchain-types';
import { Provider } from '../../decorators/provider.decorator';
import { BalanceStrategyFactory } from '../../strategies/balance-strategy.factory';
import { BalanceAdapterFactory } from '../../adapters/balance-adapter.factory';
import { BalanceStrategy } from '../../strategies/balance-strategy.interface';
import { Core } from '@quicknode/sdk';

/**
 * QuickNode 以太坊提供者門面實現
 * 使用策略模式與適配器模式實現多鏈互操作性
 */
@Provider({
  blockchainType: ChainName.ETHEREUM,
  providerType: ProviderType.QUICKNODE,
})
@Injectable()
export class EthereumQuickNodeProvider
  extends AbstractEthereumProviderService
  implements OnModuleInit
{
  // 策略映射表，按網路類型索引
  private strategies: Map<NetworkType, BalanceStrategy> = new Map();
  // 用於管理底層客戶端
  private ethereumMainnetClient: Core | null = null;
  private ethereumTestnetClient: Core | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
  }

  /**
   * 模組初始化時設置策略
   */
  async onModuleInit(): Promise<void> {
    await this.initializeClients();
    this.initializeStrategies();
  }

  /**
   * 初始化 QuickNode 客戶端
   */
  private async initializeClients(): Promise<void> {
    // 初始化以太坊主網客戶端
    const ethMainnetEndpoint = this.configService.get<string>('QUICKNODE_ETH_MAINNET_URL');

    if (ethMainnetEndpoint) {
      try {
        this.ethereumMainnetClient = new Core({
          endpointUrl: ethMainnetEndpoint,
          // 啟用 NFT 和 Token API
          config: {
            addOns: {
              nftTokenV2: true,
            },
          },
        });
        this.logInfo('QuickNode Ethereum mainnet client initialized');
      } catch (error) {
        this.logError(`Failed to initialize QuickNode Ethereum mainnet client: ${error}`);
      }
    } else {
      this.logWarning('QuickNode Ethereum mainnet endpoint is not configured');
    }

    // 初始化以太坊測試網客戶端 (Sepolia)
    const ethTestnetEndpoint = this.configService.get<string>('QUICKNODE_ETH_TESTNET_URL');

    if (ethTestnetEndpoint) {
      try {
        this.ethereumTestnetClient = new Core({
          endpointUrl: ethTestnetEndpoint,
          // 啟用 NFT 和 Token API
          config: {
            addOns: {
              nftTokenV2: true,
            },
          },
        });
        this.logInfo('QuickNode Ethereum testnet client initialized');
      } catch (error) {
        this.logError(`Failed to initialize QuickNode Ethereum testnet client: ${error}`);
      }
    } else {
      this.logWarning('QuickNode Ethereum testnet endpoint is not configured');
    }
  }

  /**
   * 初始化策略
   */
  private initializeStrategies(): void {
    try {
      // 將策略工廠與適配器工廠結合使用
      if (this.ethereumMainnetClient) {
        // 註冊以太坊主網策略
        const mainnetEndpoint = this.configService.get<string>('QUICKNODE_ETH_MAINNET_URL', '');
        const testnetEndpoint = this.configService.get<string>('QUICKNODE_ETH_TESTNET_URL', '');

        // 通過策略工廠創建策略實例
        const ethereumStrategy = BalanceStrategyFactory.createQuickNodeStrategy(
          ChainName.ETHEREUM,
          mainnetEndpoint,
          testnetEndpoint,
        );

        // 註冊主網和測試網策略
        this.strategies.set(NetworkType.MAINNET, ethereumStrategy);
        this.strategies.set(NetworkType.TESTNET, ethereumStrategy);

        this.logInfo('QuickNode Ethereum strategies initialized');
      } else {
        this.logWarning('Could not initialize QuickNode strategies: client not available');
      }
    } catch (error) {
      this.logError(`Failed to initialize QuickNode strategies: ${error}`);
    }
  }

  /**
   * 獲取提供者名稱
   */
  getProviderName(): string {
    return 'QuickNode';
  }

  /**
   * 檢查提供者是否支援
   */
  isSupported(): boolean {
    return this.strategies.has(NetworkType.MAINNET);
  }

  /**
   * 獲取 QuickNode API 的基礎 URL
   * @param networkType 網絡類型
   */
  getBaseUrl(networkType: NetworkType = NetworkType.MAINNET): string {
    return networkType === NetworkType.TESTNET
      ? this.configService.get<string>('QUICKNODE_ETH_TESTNET_URL', '')
      : this.configService.get<string>('QUICKNODE_ETH_MAINNET_URL', '');
  }

  /**
   * 獲取 API 金鑰
   * 注意：QuickNode 端點 URL 已經包含了 API 金鑰，此方法返回空字符串
   */
  getApiKey(): string {
    return '';
  }

  /**
   * 獲取地址的以太坊餘額資訊 - 使用策略模式實現
   * @param address 以太坊地址
   * @param networkType 網絡類型
   */
  async getBalances(
    address: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<BalancesResponse> {
    try {
      this.logInfo(
        `Getting balances for ${address} using QuickNode provider on ${networkType} network`,
      );

      // 檢查地址有效性
      if (!this.validateEthereumAddress(address)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
      }

      // 獲取策略
      const strategy = this.strategies.get(networkType);
      if (!strategy) {
        throw new Error(`No strategy available for network type: ${networkType}`);
      }

      // 使用策略獲取原始數據
      const rawData = await strategy.getRawBalances(address, networkType);

      // 使用適配器轉換為統一格式
      return BalanceAdapterFactory.forProvider(
        ChainName.ETHEREUM,
        ProviderType.QUICKNODE,
      ).toBalancesResponse(rawData);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get balances from QuickNode: ${errorMessage}`);

      // 拋出錯誤，讓調用者可以處理
      throw new Error(`QuickNode provider error: ${errorMessage}`);
    }
  }

  /**
   * 獲取 Gas 價格
   * @param networkType 網絡類型
   */
  async getGasPrice(networkType: NetworkType = NetworkType.MAINNET): Promise<string> {
    try {
      // 獲取策略
      const strategy = this.strategies.get(networkType);
      if (!strategy) {
        throw new Error(`No strategy available for network type: ${networkType}`);
      }

      // 使用策略獲取原始 Gas 數據
      const rawGasData = await strategy.getRawGasPrice(networkType);

      // 使用適配器轉換為統一格式
      return BalanceAdapterFactory.forProvider(
        ChainName.ETHEREUM,
        ProviderType.QUICKNODE,
      ).toGasPrice(rawGasData);
    } catch (error) {
      this.logError(`Failed to get gas price: ${error}`);
      throw new Error(`Failed to get gas price: ${error}`);
    }
  }

  /**
   * 獲取詳細的 Gas 價格資訊
   * @param networkType 網絡類型
   */
  async getDetailedGasPrice(networkType: NetworkType = NetworkType.MAINNET): Promise<{
    gasPrice: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    formatted: {
      gasPrice: string;
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
    };
  }> {
    try {
      // 獲取策略
      const strategy = this.strategies.get(networkType);
      if (!strategy) {
        throw new Error(`No strategy available for network type: ${networkType}`);
      }

      // 使用策略獲取原始 Gas 數據
      const rawGasData = await strategy.getRawGasPrice(networkType);

      // 處理結果
      const gasPrice = rawGasData.gasPrice || '0';
      const maxFeePerGas = rawGasData.maxFeePerGas || gasPrice;
      const maxPriorityFeePerGas = rawGasData.maxPriorityFeePerGas || '0';

      return {
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        formatted: {
          gasPrice: this.formatGasToGwei(gasPrice),
          maxFeePerGas: this.formatGasToGwei(maxFeePerGas),
          maxPriorityFeePerGas: this.formatGasToGwei(maxPriorityFeePerGas),
        },
      };
    } catch (error) {
      this.logError(`Failed to get detailed gas price: ${error}`);
      throw new Error(`Failed to get detailed gas price: ${error}`);
    }
  }

  /**
   * 估算交易的 Gas 用量
   * @param txData 交易數據
   * @param networkType 網絡類型
   */
  async estimateGas(
    txData: EthereumTransactionRequest,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<string> {
    try {
      // 獲取策略
      const strategy = this.strategies.get(networkType);
      if (!strategy) {
        throw new Error(`No strategy available for network type: ${networkType}`);
      }

      // 使用策略估算 Gas
      const rawEstimateGas = await strategy.getRawEstimateGas(txData, networkType);

      // 使用適配器轉換為統一格式
      return BalanceAdapterFactory.forProvider(
        ChainName.ETHEREUM,
        ProviderType.QUICKNODE,
      ).toEstimateGas(rawEstimateGas);
    } catch (error) {
      this.logError(`Failed to estimate gas: ${error}`);
      throw new Error(`Failed to estimate gas: ${error}`);
    }
  }

  /**
   * 獲取以太坊 ERC20 Token 餘額
   * @param address 錢包地址
   * @param contractAddress 代幣合約地址
   * @param networkType 網絡類型
   */
  async getErc20Balance(
    address: string,
    contractAddress: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<string> {
    try {
      this.logInfo(
        `Getting ERC20 balance for ${address} on contract ${contractAddress} using QuickNode provider`,
      );

      // 檢查地址有效性
      if (
        !this.validateEthereumAddress(address) ||
        !this.validateEthereumAddress(contractAddress)
      ) {
        throw new Error('Invalid Ethereum address');
      }

      // 獲取 Core 客戶端以進行 RPC 調用
      const client =
        networkType === NetworkType.TESTNET
          ? this.ethereumTestnetClient || this.ethereumMainnetClient
          : this.ethereumMainnetClient;

      if (!client) {
        throw new Error('QuickNode client not initialized');
      }

      // 嘗試使用 QuickNode Token API
      const clientAny = client.client as any;
      if (typeof clientAny.qn_fetchTokenBalances === 'function') {
        try {
          const response = await clientAny.qn_fetchTokenBalances({
            wallet: address,
            contracts: [contractAddress],
          });

          if (response && Array.isArray(response.tokens) && response.tokens.length > 0) {
            return response.tokens[0].amount || '0';
          }
        } catch (error) {
          this.logError(`Error using qn_fetchTokenBalances: ${error}`);
          // 繼續使用傳統方法
        }
      }

      // 使用傳統 ERC20 合約調用方法 - 直接調用合約的 balanceOf 函數
      const balanceOfSelector = '0x70a08231'; // balanceOf 函數選擇器
      const paddedAddress = address.slice(2).padStart(64, '0');
      const data = `${balanceOfSelector}${paddedAddress}` as `0x${string}`;

      const balanceResult = await client.client.call({
        to: this.ensureHexAddress(contractAddress),
        data,
      });

      // 處理回傳結果 - QuickNode 的 call 方法應該返回十六進位字串
      if (!balanceResult) {
        return '0';
      }

      try {
        const balanceStr = balanceResult as unknown as string;
        if (balanceStr && balanceStr.startsWith && balanceStr.startsWith('0x')) {
          return BigInt(balanceStr).toString();
        } else {
          this.logError(`Unexpected balance result format: ${typeof balanceResult}`);
          return '0';
        }
      } catch (error) {
        this.logError(`Error processing balance result: ${error}`);
        return '0';
      }
    } catch (error) {
      this.logError(`Failed to get ERC20 balance: ${error}`);
      throw new Error(`Failed to get ERC20 balance: ${error}`);
    }
  }

  /**
   * 獲取以太坊 ERC721 NFT 資訊
   * @param address 錢包地址
   * @param contractAddress NFT 合約地址（可選）
   * @param networkType 網絡類型
   */
  async getErc721Tokens(
    address: string,
    contractAddress?: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<any[]> {
    try {
      this.logInfo(`Getting ERC721 tokens for ${address} using QuickNode provider`);

      // 檢查地址有效性
      if (!this.validateEthereumAddress(address)) {
        throw new Error('Invalid Ethereum address');
      }

      // 獲取 Core 客戶端以進行 RPC 調用
      const client =
        networkType === NetworkType.TESTNET
          ? this.ethereumTestnetClient || this.ethereumMainnetClient
          : this.ethereumMainnetClient;

      if (!client) {
        throw new Error('QuickNode client not initialized');
      }

      // 使用 QuickNode NFT API
      const clientAny = client.client as any;
      if (typeof clientAny.qn_fetchNFTs === 'function') {
        const params: any = {
          wallet: address,
          perPage: 100,
          page: 1,
        };

        // 如果指定了合約地址，添加到參數中
        if (contractAddress) {
          if (!this.validateEthereumAddress(contractAddress)) {
            throw new Error('Invalid NFT contract address');
          }
          params.contracts = [contractAddress];
        }

        const nftsResponse = await clientAny.qn_fetchNFTs(params);

        if (nftsResponse && Array.isArray(nftsResponse.assets)) {
          return nftsResponse.assets.map((nft: any) => ({
            contractAddress: nft.collectionAddress,
            tokenId: nft.tokenId,
            name: nft.name || '',
            symbol: nft.collectionName || '',
            tokenURI: nft.imageUrl || '',
            standard: nft.collectionTokenType || 'ERC721',
            metadata: {
              image: nft.imageUrl || '',
              attributes: nft.traits || [],
            },
          }));
        }
      }

      // 如果 NFT API 不可用，提供基本資訊
      if (contractAddress) {
        return [
          {
            contractAddress,
            message: 'NFT API not available on this QuickNode endpoint',
          },
        ];
      }

      return [];
    } catch (error) {
      this.logError(`Failed to get ERC721 tokens: ${error}`);
      throw new Error(`Failed to get ERC721 tokens: ${error}`);
    }
  }

  /**
   * 將 Gas 值格式化為 Gwei
   */
  private formatGasToGwei(value: string): string {
    try {
      // 檢查是否為有效數字
      const num = BigInt(value);
      // 將 wei 轉換為 gwei (1 gwei = 10^9 wei)
      const gwei = Number(num) / 1e9;
      return gwei.toFixed(2) + ' Gwei';
    } catch (error) {
      return '0 Gwei';
    }
  }

  /**
   * 確保地址格式為 0x 前綴的十六進制字符串
   * @param address 以太坊地址
   */
  private ensureHexAddress(address: string): `0x${string}` {
    if (!address) {
      return '0x0000000000000000000000000000000000000000';
    }

    const normalizedAddress = address.toLowerCase();

    if (!normalizedAddress.startsWith('0x')) {
      return `0x${normalizedAddress}`;
    }

    return normalizedAddress as `0x${string}`;
  }
}
