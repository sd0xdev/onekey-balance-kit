import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NetworkType,
  BalancesResponse,
  ChainConfig,
} from '../blockchain/blockchain-provider.interface';
import { StandardChainType } from '../blockchain/blockchain.constants';
import { BaseRpcProvider } from './base-rpc.provider';

@Injectable()
export class SolanaRpcProvider extends BaseRpcProvider {
  constructor(configService: ConfigService) {
    super(configService, StandardChainType.SOLANA, 'Solana');
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
      // 1. 獲取 SOL 原生餘額
      const solBalance = await this.getSolBalance(address, networkType);

      // 2. 獲取代幣餘額
      const tokens = await this.getTokenBalances(address, networkType);

      // 3. 獲取 NFTs
      const nfts = await this.getNfts(address, networkType);

      return {
        nativeBalance: {
          balance: solBalance,
        },
        tokens,
        nfts,
      };
    } catch (error) {
      this.logger.error(`Failed to get Solana balances: ${error.message}`);
      return {
        nativeBalance: { balance: '0' },
        tokens: [],
        nfts: [],
      };
    }
  }

  private async getSolBalance(address: string, networkType: NetworkType): Promise<string> {
    try {
      const balance = await this.callRpcMethod('getBalance', [address], networkType);
      return (balance.value / 1e9).toString(); // 將 lamports 轉換為 SOL
    } catch (error) {
      this.logger.error(`Failed to get SOL balance: ${error.message}`);
      return '0';
    }
  }

  private async getTokenBalances(address: string, networkType: NetworkType): Promise<any[]> {
    try {
      // 獲取所有 SPL 代幣賬戶
      const tokenAccounts = await this.callRpcMethod(
        'getTokenAccountsByOwner',
        [
          address,
          { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, // SPL Token program ID
          { encoding: 'jsonParsed' },
        ],
        networkType,
      );

      return tokenAccounts.value.map((account: any) => {
        const info = account.account.data.parsed.info;
        return {
          mint: info.mint,
          tokenMetadata: {
            symbol: '', // 需要從單獨的 API 獲取
            decimals: info.tokenAmount.decimals,
          },
          balance: info.tokenAmount.uiAmountString,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to get token balances: ${error.message}`);
      return [];
    }
  }

  private async getNfts(address: string, networkType: NetworkType): Promise<any[]> {
    try {
      // 使用 getProgramAccounts 查詢與特定地址相關的 Metaplex 賬戶
      // 這是一個簡化的實現，實際情況需要更複雜的邏輯
      const nftAccounts = await this.callRpcMethod(
        'getProgramAccounts',
        [
          'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', // Metaplex metadata program ID
          {
            encoding: 'jsonParsed',
            filters: [
              { dataSize: 679 }, // 固定大小的 Metadata 賬戶
              {
                memcmp: {
                  offset: 326,
                  bytes: address,
                },
              },
            ],
          },
        ],
        networkType,
      );

      return nftAccounts
        .map((account: any) => {
          try {
            const metadata = account.account.data.parsed;
            return {
              mint: metadata.mint,
              tokenId: '', // Solana 不使用 ERC-721 風格的 tokenId
              tokenMetadata: {
                collection: {
                  name: metadata.collection?.name || 'Unknown Collection',
                },
                name: metadata.data.name,
                image: metadata.data.uri, // 這通常是指向 JSON 元數據的 URI，而不是直接的圖像
              },
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      this.logger.error(`Failed to get NFTs: ${error.message}`);
      return [];
    }
  }
}
