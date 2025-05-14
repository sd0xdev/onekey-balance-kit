import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicKey } from '@solana/web3.js';
import { BlockchainProviderFactory } from '../../../providers/blockchain/blockchain-provider.factory';
import { StandardChainType } from '../../../providers/blockchain/blockchain.constants';
import { AbstractChainService } from '../abstract-chain.service';
import { Chain } from '../../decorators/chain.decorator';
import { ChainName } from '../../constants/index';
import { SolanaCluster, SOL_SYMBOL, SOL_DECIMALS } from './constants';

/**
 * Solana 餘額響應介面
 */
export interface SolanaBalancesResponse {
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
export class SolanaService extends AbstractChainService {
  protected readonly chainType = StandardChainType.SOLANA;

  constructor(
    protected readonly blockchainProviderFactory: BlockchainProviderFactory,
    protected readonly configService: ConfigService,
  ) {
    super();
  }

  getChainName(): string {
    return ChainName.SOLANA;
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

  async getBalances(address: string, useTestnet = false): Promise<SolanaBalancesResponse> {
    try {
      this.logInfo(`Getting Solana balances for ${address}`);
      // 先驗證地址有效性
      if (!this.isValidAddress(address)) {
        throw new Error(`Invalid Solana address: ${address}`);
      }

      // 使用傳入的參數確定使用哪個集群
      const cluster = useTestnet ? SolanaCluster.TESTNET : SolanaCluster.MAINNET;
      this.logInfo(`Cluster: ${cluster}`);

      // 模擬異步操作
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 此處將實現獲取餘額的實際邏輯
      // 示例返回
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
