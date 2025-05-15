import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicKey } from '@solana/web3.js';
import { ProviderFactory } from '../../../providers/provider.factory';
import { AbstractChainService } from '../core/abstract-chain.service';
import { Chain } from '../../decorators/chain.decorator';
import { ChainName } from '../../constants/index';
import { SolanaCluster, SOL_SYMBOL, SOL_DECIMALS } from './constants';
import { BlockchainType, ProviderType } from '../../../providers/constants/blockchain-types';
import { NetworkType } from '../../../providers/interfaces/blockchain-provider.interface';
import { BalanceQueryable, BalanceResponse } from '../../interfaces/balance-queryable.interface';

/**
 * Solana 餘額響應介面
 */
export interface SolanaBalancesResponse extends BalanceResponse {
  cluster: SolanaCluster;
  nativeBalance: {
    symbol: string;
    decimals: number;
    balance: string;
    usd: number;
  };
  tokens: {
    mint: string;
    balance: string;
    tokenMetadata?: {
      symbol: string;
      decimals: number;
      name: string;
    };
  }[];
  nfts: {
    mint: string;
    tokenId: string;
    tokenMetadata?: {
      name: string;
      image: string;
      collection?: {
        name: string;
      };
    };
  }[];
  updatedAt: number;
}

@Injectable()
@Chain(ChainName.SOLANA)
export class SolanaService extends AbstractChainService implements BalanceQueryable {
  protected readonly chainType = 'solana';

  constructor(
    protected readonly providerFactory: ProviderFactory,
    protected readonly configService: ConfigService,
  ) {
    super();
    // 設置默認提供者，可以從配置中獲取
    const defaultProvider = this.configService.get<string>('blockchain.defaultProvider', 'alchemy');
    this.setDefaultProvider(defaultProvider);
  }

  getChainName(): string {
    return ChainName.SOLANA;
  }

  getChainSymbol(): string {
    return SOL_SYMBOL;
  }

  isValidAddress(address: string): boolean {
    try {
      // 使用 Solana SDK 的 PublicKey 來驗證地址
      new PublicKey(address);
      return true;
    } catch (error) {
      this.logDebug(`Invalid Solana address: ${address}, error: ${error.message}`);
      return false;
    }
  }

  async getAddressTransactionHashes(address: string): Promise<string[]> {
    this.logInfo(`Getting transactions for ${address}`);
    // 模擬異步操作
    await new Promise((resolve) => setTimeout(resolve, 10));
    // 實際實現將從區塊鏈供應商獲取交易數據
    return ['sample_hash_1', 'sample_hash_2']; // 示例數據
  }

  async getTransactionDetails(hash: string): Promise<any> {
    this.logInfo(`Getting details for transaction ${hash}`);
    // 模擬異步操作
    await new Promise((resolve) => setTimeout(resolve, 10));
    // 實際實現將從區塊鏈供應商獲取交易詳情
    return {
      hash,
      slot: 123456789,
      blockTime: Date.now() / 1000,
      fee: 5000,
    };
  }

  async getBalances(
    address: string,
    useTestnet = false,
    providerType?: string,
  ): Promise<SolanaBalancesResponse> {
    try {
      this.logInfo(`Getting Solana balances for ${address}`);
      // 先驗證地址有效性
      if (!this.isValidAddress(address)) {
        throw new Error(`Invalid Solana address: ${address}`);
      }

      // 使用傳入的參數確定使用哪個集群
      const cluster = useTestnet ? SolanaCluster.TESTNET : SolanaCluster.MAINNET;
      const networkType = useTestnet ? NetworkType.TESTNET : NetworkType.MAINNET;
      this.logInfo(`Cluster: ${cluster}`);

      // 獲取提供者類型，按照優先級：
      // 1. Function level (函數參數)
      // 2. Class level (this.getDefaultProvider())
      // 3. Default level (alchemy)
      const selectedProviderType =
        providerType || this.getDefaultProvider() || ProviderType.ALCHEMY;

      this.logInfo(`Selected provider type: ${selectedProviderType}`);

      try {
        // 從提供者工廠獲取 Solana 提供者
        const provider = this.providerFactory.getProvider(
          BlockchainType.SOLANA,
          selectedProviderType,
        );

        if (provider && provider.isSupported()) {
          this.logInfo(`Using ${provider.getProviderName()} provider for Solana`);

          // 從提供者獲取餘額數據
          const balancesResponse = await provider.getBalances(address, networkType);

          // 檢查是否成功獲取餘額數據
          if (balancesResponse.isSuccess === false) {
            this.logError(`Provider error: ${balancesResponse.errorMessage}`);
            throw new Error(balancesResponse.errorMessage || 'Failed to get balance from provider');
          }

          // 將提供者的響應轉換為 SolanaBalancesResponse 格式
          return {
            cluster,
            nativeBalance: {
              symbol: SOL_SYMBOL,
              decimals: SOL_DECIMALS,
              balance: balancesResponse.nativeBalance.balance,
              usd: 0, // 可以從其他服務獲取價格
            },
            tokens: balancesResponse.tokens.map((token) => ({
              mint: token.mint,
              balance: token.balance,
              tokenMetadata: {
                symbol: token.tokenMetadata?.symbol || 'UNKNOWN',
                decimals: token.tokenMetadata?.decimals || 9,
                name: token.tokenMetadata?.name || 'Unknown Token',
              },
            })),
            nfts: balancesResponse.nfts.map((nft) => ({
              mint: nft.mint,
              tokenId: nft.tokenId || '0',
              tokenMetadata: {
                name: nft.tokenMetadata?.name || 'Unknown NFT',
                image: nft.tokenMetadata?.image || '',
                collection: {
                  name: nft.tokenMetadata?.collection?.name || 'Unknown Collection',
                },
              },
            })),
            updatedAt: Math.floor(Date.now() / 1000),
          };
        } else {
          throw new Error(`Provider ${selectedProviderType} is not supported`);
        }
      } catch (providerError) {
        this.logWarn(
          `Provider error: ${String(providerError)}, falling back to default implementation`,
        );
      }

      // 如果沒有可用的提供者或提供者調用失敗，使用默認實現
      this.logInfo('Using default implementation for balances');
      return {
        cluster,
        nativeBalance: {
          symbol: SOL_SYMBOL,
          decimals: SOL_DECIMALS,
          balance: '1000000000', // 1 SOL (lamports)
          usd: 100, // 假設 SOL 價格為 $100
        },
        tokens: [
          {
            mint: 'TokenMintAddress1',
            balance: '100000000',
            tokenMetadata: {
              symbol: 'TOKEN',
              decimals: 9,
              name: 'Example Token',
            },
          },
        ],
        nfts: [
          {
            mint: 'NftMintAddress1',
            tokenId: '1',
            tokenMetadata: {
              name: 'Example NFT',
              image: 'https://example.com/nft.png',
              collection: {
                name: 'Example Collection',
              },
            },
          },
        ],
        updatedAt: Math.floor(Date.now() / 1000),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get Solana balances: ${errorMessage}`);
      return {
        cluster: useTestnet ? SolanaCluster.TESTNET : SolanaCluster.MAINNET,
        nativeBalance: {
          symbol: SOL_SYMBOL,
          decimals: SOL_DECIMALS,
          balance: '0',
          usd: 0,
        },
        tokens: [],
        nfts: [],
        updatedAt: Math.floor(Date.now() / 1000),
      };
    }
  }
}
