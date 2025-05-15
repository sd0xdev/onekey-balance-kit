import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Alchemy, Network, TokenBalanceType, OwnedNft } from 'alchemy-sdk';
import { AbstractEthereumProviderService } from '../../abstract/abstract-ethereum-provider.service';
import { BalancesResponse, NetworkType } from '../../interfaces/blockchain-provider.interface';
import { EthereumTransactionRequest } from '../../interfaces/ethereum-provider.interface';
import { BlockchainType, ProviderType } from '../../constants/blockchain-types';
import { Provider } from '../../decorators/provider.decorator';
import { formatUnits } from 'ethers';

/**
 * Alchemy 以太坊提供者實現
 */
@Provider({
  blockchainType: BlockchainType.ETHEREUM,
  providerType: ProviderType.ALCHEMY,
})
@Injectable()
export class EthereumAlchemyProvider extends AbstractEthereumProviderService {
  private ethereumMainnetClient: Alchemy;
  private ethereumTestnetClient: Alchemy;

  constructor(private readonly configService: ConfigService) {
    super();
    this.initializeClients();
  }

  /**
   * 初始化 Alchemy 客戶端
   */
  private initializeClients(): void {
    // 初始化以太坊主網客戶端
    const ethMainnetApiKey =
      this.configService.get<string>('ALCHEMY_API_KEY_ETH_MAINNET') ||
      this.configService.get<string>('ALCHEMY_API_KEY_ETH');

    if (ethMainnetApiKey) {
      this.ethereumMainnetClient = new Alchemy({
        apiKey: ethMainnetApiKey,
        network: Network.ETH_MAINNET,
      });

      this.logInfo('Ethereum mainnet client initialized');
    } else {
      this.logWarning('Ethereum mainnet API key is not configured');
    }

    // 初始化以太坊測試網客戶端 (Sepolia)
    const ethTestnetApiKey =
      this.configService.get<string>('ALCHEMY_API_KEY_ETH_TESTNET') ||
      this.configService.get<string>('ALCHEMY_API_KEY_ETH');

    if (ethTestnetApiKey) {
      this.ethereumTestnetClient = new Alchemy({
        apiKey: ethTestnetApiKey,
        network: Network.ETH_SEPOLIA,
      });

      this.logInfo('Ethereum testnet client initialized');
    } else {
      this.logWarning('Ethereum testnet API key is not configured');
    }
  }

  /**
   * 獲取以太坊客戶端
   * @param networkType 網絡類型
   */
  private getClient(networkType: NetworkType = NetworkType.MAINNET): Alchemy {
    const isTestnet = networkType === NetworkType.TESTNET;

    if (isTestnet) {
      if (!this.ethereumTestnetClient) {
        this.logWarning('Ethereum testnet client not initialized, falling back to mainnet client');
        return this.ethereumMainnetClient;
      }
      return this.ethereumTestnetClient;
    }

    return this.ethereumMainnetClient;
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
    const apiKey = this.getApiKey();
    return !!apiKey && !!this.ethereumMainnetClient;
  }

  /**
   * 獲取 Alchemy API 的基礎 URL
   * @param networkType 網絡類型
   */
  getBaseUrl(networkType: string = NetworkType.MAINNET.toString()): string {
    const network =
      networkType === NetworkType.TESTNET.toString() ? 'ethereum-sepolia' : 'ethereum-mainnet';
    return `https://${network}.g.alchemy.com/v2/`;
  }

  /**
   * 獲取 Alchemy API 密鑰
   * @param networkType 網絡類型
   */
  getApiKey(networkType: string = NetworkType.MAINNET.toString()): string {
    const keyEnvVar =
      networkType === NetworkType.TESTNET.toString()
        ? 'ALCHEMY_API_KEY_ETH_TESTNET'
        : 'ALCHEMY_API_KEY_ETH_MAINNET';

    const fallbackKeyEnvVar = 'ALCHEMY_API_KEY_ETH';

    return (
      this.configService.get<string>(keyEnvVar) ||
      this.configService.get<string>(fallbackKeyEnvVar, '')
    );
  }

  /**
   * 獲取地址的以太坊餘額資訊
   * @param address 以太坊地址
   * @param networkType 網絡類型
   */
  async getBalances(
    address: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<BalancesResponse> {
    try {
      this.logInfo(
        `Getting balances for ${address} using Alchemy provider on ${networkType} network`,
      );

      // 檢查地址有效性
      if (!this.validateEthereumAddress(address)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
      }

      // 獲取 Alchemy 客戶端
      const client = this.getClient(networkType);

      if (!client) {
        throw new Error('Alchemy client not initialized');
      }

      // 使用 Alchemy SDK 獲取原生代幣餘額
      const nativeBalance = await client.core.getBalance(address);

      // 使用 Alchemy SDK 獲取 ERC20 代幣餘額
      const tokenBalancesResponse = await client.core.getTokenBalances(address, {
        type: TokenBalanceType.ERC20,
      });

      // 獲取代幣的元數據
      const tokenMetadataPromises = tokenBalancesResponse.tokenBalances.map((token) =>
        client.core.getTokenMetadata(token.contractAddress),
      );

      const tokenMetadataResults = await Promise.all(tokenMetadataPromises);

      // 組合代幣資訊
      const tokens = tokenBalancesResponse.tokenBalances.map((token, index) => {
        const metadata = tokenMetadataResults[index];
        return {
          mint: token.contractAddress,
          tokenMetadata: {
            symbol: metadata?.symbol || 'UNKNOWN',
            decimals: metadata?.decimals || 18,
            name: metadata?.name || 'Unknown Token',
          },
          balance: token.tokenBalance || '0',
        };
      });

      // 使用 Alchemy SDK 獲取 NFT
      const nftsResponse = await client.nft.getNftsForOwner(address);

      // 處理 NFT 資訊
      const nfts = nftsResponse.ownedNfts.map((nft) => {
        // 獲取圖片 URL
        let imageUrl = '';

        // 根據 SDK 實際結構獲取圖片 URL
        if (nft.raw.metadata?.image) {
          imageUrl = nft.raw.metadata.image as string;
        }

        return {
          mint: nft.contract.address,
          tokenId: nft.tokenId,
          tokenMetadata: {
            name: nft.raw.metadata?.name || nft.contract.name || 'Unknown NFT',
            image: imageUrl,
            collection: {
              name: nft.contract.name || 'Unknown Collection',
            },
          },
        };
      });

      return {
        nativeBalance: {
          balance: nativeBalance.toString(),
        },
        tokens,
        nfts,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get balances from Alchemy: ${errorMessage}`);

      // 返回空結果作為後備
      return {
        nativeBalance: {
          balance: '0',
        },
        tokens: [],
        nfts: [],
      };
    }
  }

  /**
   * 獲取以太坊 Gas 價格
   * 使用 Alchemy SDK 獲取 Gas 價格資訊
   * @param networkType 網絡類型
   */
  async getGasPrice(networkType: NetworkType = NetworkType.MAINNET): Promise<string> {
    try {
      const client = this.getClient(networkType);

      // 使用 Alchemy SDK 獲取區塊資訊，其中包含 gasPrice
      const feeData = await client.core.getFeeData();

      // 如果有 maxFeePerGas (EIP-1559)，則使用它，否則使用傳統 gasPrice
      if (feeData.maxFeePerGas) {
        return feeData.maxFeePerGas.toString();
      }

      return feeData.gasPrice?.toString() || '0';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get gas price: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 獲取詳細的 Gas 價格資訊，包括 EIP-1559 的值
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
      const client = this.getClient(networkType);
      const feeData = await client.core.getFeeData();

      // 處理 gas price 參數，確保有正確的字符串格式
      const gasPriceStr = feeData.gasPrice?.toString() || '0';
      const maxFeePerGasStr = feeData.maxFeePerGas?.toString() || '0';
      const maxPriorityFeePerGasStr = feeData.maxPriorityFeePerGas?.toString() || '0';

      return {
        gasPrice: gasPriceStr,
        maxFeePerGas: maxFeePerGasStr,
        maxPriorityFeePerGas: maxPriorityFeePerGasStr,
        formatted: {
          gasPrice: formatUnits(gasPriceStr, 'gwei'),
          maxFeePerGas: formatUnits(maxFeePerGasStr, 'gwei'),
          maxPriorityFeePerGas: formatUnits(maxPriorityFeePerGasStr, 'gwei'),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get detailed gas price: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 估算交易所需 Gas 數量
   * 使用 Alchemy SDK 進行交易估算
   * @param txData 交易資料
   * @param networkType 網絡類型
   */
  async estimateGas(
    txData: EthereumTransactionRequest,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<string> {
    try {
      const client = this.getClient(networkType);
      const gasEstimate = await client.core.estimateGas(txData);
      return gasEstimate.toString();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to estimate gas: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 獲取以太坊 ERC20 Token 餘額
   * 使用 Alchemy SDK 直接獲取代幣餘額
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
      const client = this.getClient(networkType);
      const balance = await client.core.getTokenBalances(address, [contractAddress]);

      if (balance.tokenBalances.length > 0) {
        return balance.tokenBalances[0].tokenBalance || '0';
      }

      return '0';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get ERC20 balance: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 獲取以太坊 ERC721 NFT 資訊
   * 使用 Alchemy SDK 獲取完整 NFT 資訊
   * @param address 錢包地址
   * @param contractAddress NFT 合約地址
   * @param networkType 網絡類型
   */
  async getErc721Tokens(
    address: string,
    contractAddress?: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<OwnedNft[]> {
    try {
      const client = this.getClient(networkType);
      const options = contractAddress ? { contractAddresses: [contractAddress] } : undefined;
      const nfts = await client.nft.getNftsForOwner(address, options);

      return nfts.ownedNfts;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get ERC721 tokens: ${errorMessage}`);
      throw error;
    }
  }
}
