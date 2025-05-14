import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAddress } from 'ethers';
import { BlockchainProviderFactory } from '../../../providers/blockchain/blockchain-provider.factory';
import { StandardChainType } from '../../../providers/blockchain/blockchain.constants';
import { AbstractChainService } from '../abstract-chain.service';
import { Chain } from '../../decorators/chain.decorator';
import { ChainName } from '../../constants/index';
import { EthereumChainId, ETH_SYMBOL, ETH_DECIMALS } from './constants';

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
export interface EthereumBalancesResponse {
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
@Chain(ChainName.ETHEREUM)
export class EthereumService extends AbstractChainService {
  protected readonly chainType = StandardChainType.ETHEREUM;

  constructor(
    protected readonly blockchainProviderFactory: BlockchainProviderFactory,
    protected readonly configService: ConfigService,
  ) {
    super();
  }

  getChainName(): string {
    return ChainName.ETHEREUM;
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

    // 模擬異步操作
    await new Promise((resolve) => setTimeout(resolve, 10));
    // 實際實現將從區塊鏈供應商獲取交易數據
    return ['0xsample1', '0xsample2']; // 示例數據
  }

  async getTransactionDetails(hash: string): Promise<any> {
    this.logInfo(`Getting details for transaction ${hash}`);
    // 驗證交易哈希格式
    if (!hash.startsWith('0x') || hash.length !== 66) {
      throw new Error(`Invalid Ethereum transaction hash: ${hash}`);
    }

    // 模擬異步操作
    await new Promise((resolve) => setTimeout(resolve, 10));
    // 實際實現將從區塊鏈供應商獲取交易詳情
    return {
      hash,
      from: '0xsender',
      to: '0xreceiver',
      value: '1000000000000000000', // 1 ETH in wei
    };
  }

  async getBalances(address: string, useTestnet = false): Promise<EthereumBalancesResponse> {
    try {
      this.logInfo(`Getting Ethereum balances for ${address}`);
      // 先驗證地址有效性
      if (!this.isValidAddress(address)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
      }

      // 使用傳入的參數，避免 unused parameter 警告
      const network = useTestnet ? 'testnet' : 'mainnet';
      this.logInfo(`Network: ${network}`);

      // 模擬異步操作
      await new Promise((resolve) => setTimeout(resolve, 10));
      // 此處將實現獲取餘額的實際邏輯
      // 示例返回
      return {
        chainId: useTestnet ? EthereumChainId.SEPOLIA : EthereumChainId.MAINNET,
        native: {
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
