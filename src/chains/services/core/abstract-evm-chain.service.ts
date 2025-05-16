import { isAddress } from 'ethers';
import { AbstractChainService } from './abstract-chain.service';
import { BalanceQueryable, BalanceResponse } from '../../interfaces/balance-queryable.interface';
import { ProviderFactory } from '../../../providers/provider.factory';
import { NetworkType } from '../../../providers/interfaces/blockchain-provider.interface';
import { ProviderType } from '../../../providers/constants/blockchain-types';
import { ChainCode, ChainName, EVM_CHAIN_INFO_MAP } from '../../constants';
import { Injectable } from '@nestjs/common';
import { CHAIN_INFO_MAP } from '../../../chains/constants';

/**
 * 抽象EVM鏈服務
 * 提供所有EVM兼容鏈的共享邏輯
 */
@Injectable()
export abstract class AbstractEvmChainService
  extends AbstractChainService
  implements BalanceQueryable
{
  constructor(protected readonly providerFactory: ProviderFactory) {
    super();
  }

  /**
   * 獲取實現類對應的鏈類型
   * 例如：ChainName.ETHEREUM, ChainName.POLYGON等
   */
  abstract evmChain(): ChainName;

  /**
   * 獲取鏈元數據
   */
  protected get meta() {
    return EVM_CHAIN_INFO_MAP[this.evmChain()];
  }

  /**
   * 獲取鏈名稱
   */
  getChainName(): string {
    return this.meta?.display || this.evmChain();
  }

  /**
   * 獲取鏈代幣符號
   */
  getChainSymbol(): string {
    return this.meta?.symbol || '';
  }

  /**
   * 驗證地址是否有效
   * @param address 要驗證的地址
   */
  isValidAddress(address: string): boolean {
    const isValid = isAddress(address);
    if (!isValid) {
      this.logDebug(`Invalid ${this.getChainName()} address: ${address}`);
    }
    return isValid;
  }

  /**
   * 獲取地址的交易哈希
   * @param address 區塊鏈地址
   */
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

  /**
   * 獲取交易詳情
   * @param hash 交易哈希
   */
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

  /**
   * 獲取餘額資訊
   * @param address 區塊鏈地址
   * @param useTestnet 是否使用測試網絡
   * @param providerType 提供者類型
   */
  async getBalances(
    address: string,
    useTestnet = false,
    providerType?: string,
  ): Promise<BalanceResponse> {
    try {
      this.logInfo(`Getting ${this.getChainName()} balances for ${address}`);
      // 先驗證地址有效性
      if (!this.isValidAddress(address)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
      }

      const networkType = useTestnet ? NetworkType.TESTNET : NetworkType.MAINNET;
      this.logInfo(`Network: ${networkType}`);

      // 獲取提供者類型，按照優先級：
      // 1. Function level (函數參數)
      // 2. Class level (this.getDefaultProvider())
      // 3. Default level (alchemy)
      const selectedProviderType =
        providerType || this.getDefaultProvider() || ProviderType.ALCHEMY;

      this.logInfo(`Selected provider type: ${selectedProviderType}`);

      try {
        // 從提供者工廠獲取對應鏈的提供者
        // 使用新的getEvmProvider方法，傳入對應的chainId
        const provider = this.providerFactory.getEvmProvider(
          useTestnet ? this.getTestnetChainId() : this.meta?.id || 0,
          selectedProviderType,
        );

        if (provider && provider.isSupported()) {
          this.logInfo(`Using ${provider.getProviderName()} provider for ${this.getChainName()}`);

          // 從提供者獲取餘額數據
          const balancesResponse = await provider.getBalances(address, networkType);

          // 將提供者的響應轉換為標準響應格式
          return {
            chainId: useTestnet ? this.getTestnetChainId() : this.meta?.id || 0,
            nativeBalance: {
              symbol: this.meta?.symbol || 'UNKNOWN',
              decimals: this.meta?.decimals || 18,
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
          throw new Error(`Provider ${selectedProviderType} is not supported`);
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
        chainId: useTestnet ? this.getTestnetChainId() : this.meta?.id || 0,
        nativeBalance: {
          symbol: this.meta?.symbol || 'UNKNOWN',
          decimals: this.meta?.decimals || 18,
          balance: '1000000000000000000', // 1 單位
          usd: 0,
        },
        fungibles: [],
        nfts: [],
        updatedAt: Math.floor(Date.now() / 1000),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get ${this.getChainName()} balances: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 獲取測試網的ChainID
   * 這是一個輔助方法，可被子類覆寫
   */
  protected getTestnetChainId(): number {
    const currentChain = this.evmChain();

    // 檢查當前鏈是否有對應的測試網在 CHAIN_INFO_MAP 中
    for (const [chainKey, chainInfo] of Object.entries(CHAIN_INFO_MAP)) {
      if (
        !chainInfo.isMainnet && // 是測試網
        chainInfo.mainnetRef === currentChain && // 參照的主網是當前鏈
        chainInfo.id
      ) {
        // 有有效的 id
        return chainInfo.id;
      }
    }

    // 如果在 CHAIN_INFO_MAP 中找不到，使用預設值
    const testnetMap: Partial<Record<ChainName, number>> = {
      [ChainName.ETHEREUM]: CHAIN_INFO_MAP[ChainName.ETHEREUM_SEPOLIA].id, // Sepolia
      [ChainName.POLYGON]: 80001, // Mumbai
      [ChainName.BSC]: 97, // BSC Testnet
      [ChainName.SOLANA]: 103, // Solana Devnet
    };

    return testnetMap[currentChain] || 0;
  }
}
