import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicKey } from '@solana/web3.js';
import { ProviderFactory } from '../../../providers/provider.factory';
import { AbstractChainService } from '../core/abstract-chain.service';
import { Chain } from '../../decorators/chain.decorator';
import { ChainName } from '../../constants/index';
import { SolanaCluster, SOL_SYMBOL, SOL_DECIMALS } from './constants';
import { ProviderType } from '../../../providers/constants/blockchain-types';
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
@Chain(ChainName.SOLANA, ChainName.SOLANA_DEVNET)
export class SolanaService extends AbstractChainService implements BalanceQueryable {
  protected readonly chainType = 'solana';
  // 當前chainId，預設為主網101
  protected currentChainId: number = 101;

  constructor(
    protected readonly providerFactory: ProviderFactory,
    protected readonly configService: ConfigService,
  ) {
    super();
    // 設置默認提供者，可以從配置中獲取
    const defaultProvider = this.configService.get<string>('blockchain.defaultProvider', 'alchemy');
    this.setDefaultProvider(defaultProvider);
  }

  /**
   * 設置當前使用的chainId
   * @param chainId 鏈ID
   */
  setChainId(chainId: number): void {
    this.currentChainId = chainId;
    this.logInfo(`Current Solana chain ID set to: ${chainId}`);
  }

  /**
   * 獲取當前使用的chainId
   */
  getChainId(): number {
    return this.currentChainId;
  }

  /**
   * 判斷是否為測試網
   */
  isTestnet(): boolean {
    // 主網是101，其他都視為測試網
    return this.currentChainId !== 101;
  }

  getChainName(): string {
    // 根據當前chainId返回適當的名稱
    if (this.currentChainId === 103) {
      return 'Solana Devnet';
    } else if (this.currentChainId === 102) {
      return 'Solana Testnet';
    }
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
    chainId?: number,
    providerType?: string,
  ): Promise<SolanaBalancesResponse> {
    try {
      // 如果傳入chainId，設定當前chainId
      if (chainId !== undefined) {
        this.setChainId(chainId);
      }

      this.logInfo(`Getting Solana balances for ${address} (chainId=${this.currentChainId})`);

      // 先驗證地址有效性
      if (!this.isValidAddress(address)) {
        throw new Error(`Invalid Solana address: ${address}`);
      }

      // 使用類的isTestnet方法判斷網絡類型
      const useTestnet = this.isTestnet();

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
        const provider = this.providerFactory.getProvider(ChainName.SOLANA, selectedProviderType);

        if (provider && provider.isSupported()) {
          this.logInfo(`Using ${provider.getProviderName()} provider for Solana`);

          // 從提供者獲取餘額數據
          const balancesResponse = await provider.getBalances(
            address,
            networkType,
            ChainName.SOLANA,
          );

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

      throw new Error(`Provider ${selectedProviderType} is not working`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get Solana balances: ${errorMessage}`);
      throw error;
    }
  }

  // 添加 validateAddress 方法
  validateAddress(address: string): boolean {
    return this.isValidAddress(address);
  }
}
