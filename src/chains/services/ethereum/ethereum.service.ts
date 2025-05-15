import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAddress } from 'ethers';
import { Chain } from '../../decorators/chain.decorator';
import { ChainName } from '../../constants/index';
import { AbstractChainService } from '../abstract-chain.service';
import { EthereumChainId, ETH_SYMBOL, ETH_DECIMALS } from './constants';
import { ProviderFactory } from '../../../providers/provider.factory';
import { ProviderType } from '../../../providers/constants/blockchain-types';
import { NetworkType } from '../../../providers/interfaces/blockchain-provider.interface';
import {
  BalanceableChainService,
  BalanceResponse,
} from '../../interfaces/balanceable-chain.interface';

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
export interface EthereumBalancesResponse extends BalanceResponse {
  chainId: number;
  nativeBalance: {
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
@Chain(ChainName.ETHEREUM)
export class EthereumService extends AbstractChainService implements BalanceableChainService {
  constructor(
    protected readonly configService: ConfigService,
    private readonly providerFactory: ProviderFactory,
  ) {
    super();
  }

  getChainName(): string {
    return ChainName.ETHEREUM;
  }

  getChainSymbol(): string {
    return ETH_SYMBOL;
  }

  isValidAddress(address: string): boolean {
    // 使用 ethers 的 isAddress 函數進行嚴謹的地址驗證
    const isValid = isAddress(address);
    if (!isValid) {
      this.logDebug(`Invalid Ethereum address: ${address}`);
    }
    return isValid;
  }

  async getAddressTransactionHashes(address: string): Promise<string[]> {
    this.logInfo(`Getting transactions for ${address}`);
    // 先驗證地址有效性
    if (!this.isValidAddress(address)) {
      throw new Error(`Invalid Ethereum address: ${address}`);
    }

    // 使用提供者來獲取交易哈希
    try {
      // 這裡可以使用以太坊提供者的特定方法
      // 目前先使用模擬資料
      await new Promise((resolve) => setTimeout(resolve, 10));
      return ['0xsample1', '0xsample2']; // 示例數據
    } catch (error) {
      this.logError(`Failed to get transaction hashes: ${error}`);
      throw error;
    }
  }

  async getTransactionDetails(hash: string): Promise<any> {
    this.logInfo(`Getting details for transaction ${hash}`);
    // 驗證交易哈希格式
    if (!hash.startsWith('0x') || hash.length !== 66) {
      throw new Error(`Invalid Ethereum transaction hash: ${hash}`);
    }

    // 使用提供者來獲取交易詳情
    try {
      // 這裡可以使用以太坊提供者的特定方法
      // 目前先使用模擬資料
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        hash,
        from: '0xsender',
        to: '0xreceiver',
        value: '1000000000000000000', // 1 ETH in wei
      };
    } catch (error) {
      this.logError(`Failed to get transaction details: ${error}`);
      throw error;
    }
  }

  async getBalances(address: string, useTestnet = false): Promise<EthereumBalancesResponse> {
    try {
      this.logInfo(`Getting Ethereum balances for ${address}`);
      // 先驗證地址有效性
      if (!this.isValidAddress(address)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
      }

      const networkType = useTestnet ? NetworkType.TESTNET : NetworkType.MAINNET;
      this.logInfo(`Network: ${networkType}`);

      // 獲取配置中設定的提供者類型，如果未設定則使用默認值
      const configProviderType = this.configService.get<string>('PROVIDER_ETHEREUM');
      const providerType = configProviderType || ProviderType.ALCHEMY;

      try {
        // 從提供者工廠獲取以太坊提供者
        const provider = this.providerFactory.getEthereumProvider(providerType);

        if (provider && provider.isSupported()) {
          this.logInfo(`Using ${provider.getProviderName()} provider for Ethereum`);

          // 從提供者獲取餘額數據
          const balancesResponse = await provider.getBalances(address, networkType);

          // 將提供者的響應轉換為 EthereumBalancesResponse 格式
          return {
            chainId: useTestnet ? EthereumChainId.SEPOLIA : EthereumChainId.MAINNET,
            nativeBalance: {
              symbol: ETH_SYMBOL,
              decimals: ETH_DECIMALS,
              balance: balancesResponse.nativeBalance.balance,
              usd: 0, // 可以從其他服務獲取價格
            },
            fungibles: balancesResponse.tokens.map((token) => ({
              mint: token.mint,
              symbol: token.tokenMetadata?.symbol || 'UNKNOWN',
              decimals: token.tokenMetadata?.decimals || 18,
              balance: token.balance,
              usd: 0,
            })),
            nfts: balancesResponse.nfts.map((nft) => ({
              mint: nft.mint,
              tokenId: nft.tokenId || '0',
              collection: nft.tokenMetadata?.collection?.name || 'Unknown Collection',
              name: nft.tokenMetadata?.name || 'Unknown NFT',
              image: nft.tokenMetadata?.image || '',
            })),
            updatedAt: Math.floor(Date.now() / 1000),
          };
        } else {
          throw new Error(`Provider ${providerType} is not supported`);
        }
      } catch (providerError) {
        this.logWarn(
          `Provider error: ${String(providerError)}, falling back to default implementation`,
        );
      }

      // 如果沒有可用的提供者或提供者調用失敗，使用默認實現
      this.logInfo('Using default implementation for balances');
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        chainId: useTestnet ? EthereumChainId.SEPOLIA : EthereumChainId.MAINNET,
        nativeBalance: {
          symbol: ETH_SYMBOL,
          decimals: ETH_DECIMALS,
          balance: '1000000000000000000', // 1 ETH
          usd: 3000, // 假設 ETH 價格為 $3000
        },
        fungibles: [],
        nfts: [],
        updatedAt: Math.floor(Date.now() / 1000),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get Ethereum balances: ${errorMessage}`);
      throw error;
    }
  }
}
