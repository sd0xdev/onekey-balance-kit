import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlchemyBaseProvider } from './alchemy-base.provider';
import {
  NetworkType,
  BalancesResponse,
  ChainConfig,
} from '../blockchain/blockchain-provider.interface';

@Injectable()
export class AlchemySolanaProvider extends AlchemyBaseProvider {
  constructor(protected readonly configService: ConfigService) {
    super(
      configService,
      'Solana',
      'ALCHEMY_API_KEY_SOL_MAINNET',
      'ALCHEMY_API_KEY_SOL_TESTNET',
      'ALCHEMY_API_KEY_SOL',
      'https://solana-mainnet.g.alchemy.com',
      'https://solana-devnet.g.alchemy.com',
    );
  }

  public getChainConfig(): ChainConfig {
    return {
      chainId: 1, // Solana mainnet
      name: 'Solana',
      nativeSymbol: 'SOL',
      nativeDecimals: 9,
      testnetChainId: 2, // 使用任意值來代表 devnet
      testnetName: 'Solana Devnet',
    };
  }

  public async getBalances(
    address: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<BalancesResponse> {
    try {
      const apiKey = this.getApiKey(networkType);
      const baseUrl = this.getBaseUrl(networkType);
      const url = `${baseUrl}/v2/${apiKey}`;

      this.logger.log(`Fetching Solana balances from ${networkType} for address: ${address}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'alchemy_getTokenBalances',
          params: [address],
        }),
      });

      if (!response.ok) {
        throw new Error(`Error fetching Solana balances: ${response.statusText}`);
      }

      const data = await response.json();
      const result = data.result;

      return {
        nativeBalance: {
          balance: result.nativeBalance,
        },
        tokens: result.tokens.map((token: any) => ({
          mint: token.mint,
          tokenMetadata: {
            symbol: token.tokenMetadata?.symbol || '',
            decimals: token.tokenMetadata?.decimals || 0,
          },
          balance: token.balance,
        })),
        nfts: result.nfts.map((nft: any) => ({
          mint: nft.mint,
          tokenId: nft.tokenId || '',
          tokenMetadata: {
            collection: {
              name: nft.tokenMetadata?.collection?.name || '',
            },
            name: nft.tokenMetadata?.name || '',
            image: nft.tokenMetadata?.image || '',
          },
        })),
      };
    } catch (error) {
      this.logger.error(`Error fetching Solana balances: ${error.message}`);
      return {
        nativeBalance: { balance: '0' },
        tokens: [],
        nfts: [],
      };
    }
  }
}
