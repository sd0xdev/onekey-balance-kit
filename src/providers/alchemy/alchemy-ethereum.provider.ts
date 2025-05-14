import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlchemyBaseProvider } from './alchemy-base.provider';
import {
  NetworkType,
  BalancesResponse,
  ChainConfig,
  TokenBalance,
  NftBalance,
} from '../blockchain/blockchain-provider.interface';
import { Alchemy, Network, Utils } from 'alchemy-sdk';

@Injectable()
export class AlchemyEthereumProvider extends AlchemyBaseProvider {
  private ethereumMainnetClient: Alchemy | undefined;
  private ethereumTestnetClient: Alchemy | undefined;

  constructor(protected readonly configService: ConfigService) {
    super(
      configService,
      'Ethereum',
      'ALCHEMY_API_KEY_ETH_MAINNET',
      'ALCHEMY_API_KEY_ETH_TESTNET',
      'ALCHEMY_API_KEY_ETH',
      'https://eth-mainnet.g.alchemy.com',
      'https://eth-sepolia.g.alchemy.com',
    );

    this.initializeClients();
  }

  private initializeClients(): void {
    if (this.mainnetApiKey) {
      this.ethereumMainnetClient = new Alchemy({
        apiKey: this.mainnetApiKey,
        network: Network.ETH_MAINNET,
      });
      this.logger.log('Ethereum mainnet client initialized');
    }

    if (this.testnetApiKey) {
      this.ethereumTestnetClient = new Alchemy({
        apiKey: this.testnetApiKey,
        network: Network.ETH_SEPOLIA,
      });
      this.logger.log('Ethereum testnet client initialized');
    }
  }

  private getClient(networkType: NetworkType = NetworkType.MAINNET): Alchemy {
    const client =
      networkType === NetworkType.MAINNET ? this.ethereumMainnetClient : this.ethereumTestnetClient;

    if (!client) {
      const networkName = networkType === NetworkType.MAINNET ? 'mainnet' : 'testnet';
      throw new Error(`Ethereum ${networkName} client not initialized`);
    }

    return client;
  }

  public getChainConfig(): ChainConfig {
    return {
      chainId: 1, // Ethereum Mainnet
      name: 'Ethereum',
      nativeSymbol: 'ETH',
      nativeDecimals: 18,
      testnetChainId: 11155111, // Sepolia Testnet
      testnetName: 'Ethereum Sepolia',
    };
  }

  public async getBalances(
    address: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<BalancesResponse> {
    try {
      const alchemy = this.getClient(networkType);

      this.logger.log(`Fetching Ethereum balances from ${networkType} for address: ${address}`);

      // 並行獲取所有餘額數據
      const [nativeBalance, tokenResponse, nftResponse] = await Promise.all([
        alchemy.core.getBalance(address, 'latest'),
        alchemy.core.getTokenBalances(address),
        alchemy.nft.getNftsForOwner(address, { omitMetadata: false }),
      ]);

      // 處理原生代幣（ETH）
      const nativeBalanceInEth = Utils.formatEther(nativeBalance);

      // 處理 ERC-20 代幣
      const tokens: TokenBalance[] = [];
      for (const tokenBalance of tokenResponse.tokenBalances) {
        if (tokenBalance.tokenBalance) {
          const metadata = await alchemy.core.getTokenMetadata(tokenBalance.contractAddress);

          tokens.push({
            mint: tokenBalance.contractAddress,
            tokenMetadata: {
              symbol: metadata.symbol || 'UNKNOWN',
              decimals: metadata.decimals || 18,
              name: metadata.name || 'Unknown Token',
            },
            balance: Utils.formatUnits(tokenBalance.tokenBalance, metadata.decimals || 18),
          });
        }
      }

      // 處理 NFT
      const nfts: NftBalance[] = nftResponse.ownedNfts.map((nft) => ({
        mint: nft.contract.address,
        tokenId: nft.tokenId,
        tokenMetadata: {
          collection: {
            name: nft.contract.name || 'Unknown Collection',
          },
          name: nft.contract.name || `#${nft.tokenId}`,
          image: '',
        },
      }));

      return {
        nativeBalance: {
          balance: nativeBalanceInEth,
        },
        tokens,
        nfts,
      };
    } catch (error) {
      this.logger.error(`Error fetching Ethereum balances: ${error.message}`);
      return {
        nativeBalance: { balance: '0' },
        tokens: [],
        nfts: [],
      };
    }
  }
}
