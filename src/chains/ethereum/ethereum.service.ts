import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainProviderFactory } from '../../providers/blockchain/blockchain-provider.factory';
import { NetworkType } from '../../providers/blockchain/blockchain-provider.interface';
import { StandardChainType } from '../../providers/blockchain/blockchain.constants';

// 定義 Fungible 類型 (用於最終輸出)
interface Fungible {
  mint: string;
  symbol: string;
  decimals: number;
  balance: string;
  usd: number;
}

// 定義 NFT 類型 (用於最終輸出)
interface Nft {
  mint: string;
  tokenId: string;
  collection: string;
  name: string;
  image: string;
}

// 最終輸出的格式
interface EthereumBalancesResponse {
  chainId: number;
  native: {
    symbol: string;
    decimals: number;
    balance: string;
    usd: number;
  };
  fungibles: Fungible[];
  nfts: Nft[];
  updatedAt: number;
}

@Injectable()
export class EthereumService {
  private readonly logger = new Logger(EthereumService.name);

  constructor(
    private readonly blockchainProviderFactory: BlockchainProviderFactory,
    private readonly configService: ConfigService,
  ) {}

  async getBalances(address: string, useTestnet = false): Promise<EthereumBalancesResponse> {
    try {
      const networkType =
        useTestnet || this.configService.get<string>('NODE_ENV') === 'development'
          ? NetworkType.TESTNET
          : NetworkType.MAINNET;

      this.logger.log(`Getting Ethereum balances for ${address} on ${networkType}`);

      const provider = this.blockchainProviderFactory.getProvider(StandardChainType.ETHEREUM);
      const chainConfig = provider.getChainConfig();
      const balances = await provider.getBalances(address, networkType);

      // 從通用格式轉換為特定的 Ethereum 輸出格式
      const chainId =
        networkType === NetworkType.MAINNET
          ? chainConfig.chainId
          : chainConfig.testnetChainId || chainConfig.chainId;

      // 處理代幣和 NFT
      const fungibles: Fungible[] = balances.tokens.map((token) => ({
        mint: token.mint,
        symbol: token.tokenMetadata?.symbol || 'UNKNOWN',
        decimals: token.tokenMetadata?.decimals || 18,
        balance: token.balance,
        usd: 0, // 需要整合價格 API
      }));

      const nfts: Nft[] = balances.nfts.map((nft) => ({
        mint: nft.mint,
        tokenId: nft.tokenId || '0',
        collection: nft.tokenMetadata?.collection?.name || 'Unknown Collection',
        name: nft.tokenMetadata?.name || `#${nft.tokenId || '0'}`,
        image: nft.tokenMetadata?.image || '',
      }));

      return {
        chainId,
        native: {
          symbol: chainConfig.nativeSymbol,
          decimals: chainConfig.nativeDecimals,
          balance: balances.nativeBalance.balance,
          usd: 0, // 需要整合價格 API
        },
        fungibles,
        nfts,
        updatedAt: Math.floor(Date.now() / 1000),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get Ethereum balances: ${errorMessage}`);
      throw error;
    }
  }
}
