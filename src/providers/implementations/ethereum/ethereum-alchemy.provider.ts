import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Alchemy, Network, TokenBalanceType, OwnedNft } from 'alchemy-sdk';
import { AbstractEvmProviderService } from '../../abstract/abstract-evm-provider.service';
import { BalancesResponse, NetworkType } from '../../interfaces/blockchain-provider.interface';
import { EthereumTransactionRequest } from '../../interfaces/evm-provider.interface';
import { ProviderType } from '../../constants/blockchain-types';
import { Provider } from '../../decorators/provider.decorator';
import { formatUnits } from 'ethers';
import { ChainName } from '../../../chains/constants';

// 定義 Alchemy 網絡映射
const ALCHEMY_NETWORK_MAP: Partial<Record<ChainName, Network>> = {
  [ChainName.ETHEREUM]: Network.ETH_MAINNET,
  [ChainName.ETHEREUM_GOERLI]: Network.ETH_GOERLI,
  [ChainName.ETHEREUM_SEPOLIA]: Network.ETH_SEPOLIA,
  [ChainName.POLYGON]: Network.MATIC_MAINNET,
  [ChainName.POLYGON_MUMBAI]: Network.MATIC_MUMBAI,
};

// 定義每條鏈的環境變數前綴
const ENV_PREFIX_MAP: Partial<Record<ChainName, string>> = {
  [ChainName.ETHEREUM]: 'ETH',
  [ChainName.ETHEREUM_GOERLI]: 'ETH',
  [ChainName.ETHEREUM_SEPOLIA]: 'ETH',
  [ChainName.POLYGON]: 'POLYGON',
  [ChainName.POLYGON_MUMBAI]: 'POLYGON',
};

/**
 * Alchemy EVM 鏈提供者實現
 * 支援多個 EVM 區塊鏈
 */
@Provider({
  blockchainType: [
    ChainName.ETHEREUM,
    ChainName.ETHEREUM_GOERLI,
    ChainName.ETHEREUM_SEPOLIA,
    ChainName.POLYGON,
    ChainName.POLYGON_MUMBAI,
  ],
  providerType: ProviderType.ALCHEMY,
})
@Injectable()
export class EthereumAlchemyProvider extends AbstractEvmProviderService {
  private chainClients: Map<string, Alchemy> = new Map();

  constructor(private readonly configService: ConfigService) {
    super();
    this.initSupportedChains([
      ChainName.ETHEREUM,
      ChainName.ETHEREUM_GOERLI,
      ChainName.ETHEREUM_SEPOLIA,
      ChainName.POLYGON,
      ChainName.POLYGON_MUMBAI,
    ]);
    this.initializeClients();
  }

  /**
   * 初始化 Alchemy 客戶端
   */
  private initializeClients(): void {
    // 為支援的每條鏈初始化客戶端
    for (const chainName of this.supportedChains) {
      // 跳過沒有 Alchemy 支援的鏈
      if (!ALCHEMY_NETWORK_MAP[chainName]) {
        continue;
      }

      // 獲取此鏈的 API 金鑰
      const networkType = this.isTestnet(chainName) ? NetworkType.TESTNET : NetworkType.MAINNET;
      const apiKey = this.getApiKey(networkType.toString(), chainName);

      if (apiKey) {
        // 為此鏈創建客戶端
        const client = new Alchemy({
          apiKey,
          network: ALCHEMY_NETWORK_MAP[chainName],
        });

        this.chainClients.set(chainName, client);
        this.logInfo(`Initialized Alchemy client for ${chainName}`);
      } else {
        this.logWarning(`API key not configured for ${chainName}`);
      }
    }
  }

  /**
   * 判斷鏈是否為測試網
   */
  private isTestnet(chainName: ChainName): boolean {
    return chainName.includes('_') || chainName.includes('testnet') || chainName.includes('devnet');
  }

  /**
   * 獲取指定鏈的客戶端
   */
  private getClient(
    networkType: NetworkType = NetworkType.MAINNET,
    chainName?: ChainName,
  ): Alchemy {
    if (!chainName) {
      chainName =
        networkType === NetworkType.TESTNET ? ChainName.ETHEREUM_SEPOLIA : ChainName.ETHEREUM;
    }

    const client = this.chainClients.get(chainName);
    if (!client) {
      throw new Error(`No Alchemy client initialized for ${chainName}`);
    }

    return client;
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
    return this.chainClients.size > 0;
  }

  /**
   * 獲取 Alchemy API 的基礎 URL
   */
  getBaseUrl(networkType: string = NetworkType.MAINNET.toString(), chainName?: ChainName): string {
    if (!chainName) {
      chainName =
        networkType === NetworkType.TESTNET.toString()
          ? ChainName.ETHEREUM_SEPOLIA
          : ChainName.ETHEREUM;
    }

    // 根據鏈名構建合適的基礎 URL
    const network = ALCHEMY_NETWORK_MAP[chainName]?.toLowerCase() || 'ethereum-mainnet';
    return `https://${network}.g.alchemy.com/v2/`;
  }

  /**
   * 獲取 Alchemy API 密鑰
   */
  getApiKey(networkType: string = NetworkType.MAINNET.toString(), chainName?: ChainName): string {
    if (!chainName) {
      chainName =
        networkType === NetworkType.TESTNET.toString()
          ? ChainName.ETHEREUM_SEPOLIA
          : ChainName.ETHEREUM;
    }

    const prefix = ENV_PREFIX_MAP[chainName] || 'ETH';
    const isTestnet = this.isTestnet(chainName);

    // 構建環境變數名稱
    const keyEnvVar = isTestnet
      ? `ALCHEMY_API_KEY_${prefix}_TESTNET`
      : `ALCHEMY_API_KEY_${prefix}_MAINNET`;

    const fallbackKeyEnvVar = `ALCHEMY_API_KEY_${prefix}`;

    return (
      this.configService.get<string>(keyEnvVar) ||
      this.configService.get<string>(fallbackKeyEnvVar, '')
    );
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
      if (!chainName) {
        chainName =
          networkType === NetworkType.TESTNET ? ChainName.ETHEREUM_SEPOLIA : ChainName.ETHEREUM;
      }

      this.logInfo(
        `Getting balances for ${address} using Alchemy provider on ${chainName} network`,
      );

      // 檢查地址有效性
      if (!this.validateEvmAddress(address)) {
        throw new Error(`Invalid address: ${address}`);
      }

      // 獲取適用於此鏈的 Alchemy 客戶端
      const client = this.getClient(networkType, chainName);

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
      const client = this.getClient(networkType, chainName);

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
   */
  async getDetailedGasPrice(
    networkType: NetworkType = NetworkType.MAINNET,
    chainName?: ChainName,
  ): Promise<{
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
      const client = this.getClient(networkType, chainName);

      // 獲取費用數據
      const feeData = await client.core.getFeeData();

      // 提取所需值
      const gasPrice = feeData.gasPrice?.toString() || '0';
      const maxFeePerGas = feeData.maxFeePerGas?.toString() || '0';
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas?.toString() || '0';

      // 格式化為 Gwei
      const formattedGasPrice = formatUnits(gasPrice, 'gwei');
      const formattedMaxFeePerGas = formatUnits(maxFeePerGas, 'gwei');
      const formattedMaxPriorityFeePerGas = formatUnits(maxPriorityFeePerGas, 'gwei');

      return {
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        formatted: {
          gasPrice: formattedGasPrice,
          maxFeePerGas: formattedMaxFeePerGas,
          maxPriorityFeePerGas: formattedMaxPriorityFeePerGas,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get detailed gas price: ${errorMessage}`);
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
      const client = this.getClient(networkType, chainName);

      // 使用 Alchemy SDK 估算 Gas
      const estimatedGas = await client.core.estimateGas({
        from: txData.from,
        to: txData.to,
        data: txData.data,
        value: txData.value,
      });

      return estimatedGas.toString();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to estimate gas: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 獲取 ERC20 Token 餘額
   */
  async getErc20Balance(
    address: string,
    contractAddress: string,
    networkType: NetworkType = NetworkType.MAINNET,
    chainName?: ChainName,
  ): Promise<string> {
    try {
      const client = this.getClient(networkType, chainName);

      // 獲取 ERC20 合約詳情
      const metadata = await client.core.getTokenMetadata(contractAddress);

      // 獲取 ERC20 Token 餘額
      const balance = await client.core.getTokenBalances(address, [contractAddress]);

      // 如果有餘額則返回，否則返回 0
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
   * 獲取 ERC721 NFT 資訊
   */
  async getErc721Tokens(
    address: string,
    contractAddress?: string,
    networkType: NetworkType = NetworkType.MAINNET,
    chainName?: ChainName,
  ): Promise<OwnedNft[]> {
    try {
      const client = this.getClient(networkType, chainName);

      // 獲取 NFT，可選擇按合約過濾
      const nfts = contractAddress
        ? await client.nft.getNftsForOwner(address, { contractAddresses: [contractAddress] })
        : await client.nft.getNftsForOwner(address);

      return nfts.ownedNfts;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get ERC721 tokens: ${errorMessage}`);
      throw error;
    }
  }
}
