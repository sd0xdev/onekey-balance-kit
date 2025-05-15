import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { ChainName, COIN_SYMBOL_TO_CHAIN_MAP } from '../../chains/constants';
import { ProviderFactory } from '../../providers/provider.factory';
import { BlockchainType, ProviderType } from '../../providers/constants/blockchain-types';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  BalanceException,
  BlockchainException,
  ProviderException,
} from '../../common/exceptions/application.exception';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly providerFactory: ProviderFactory,
  ) {}

  /**
   * 將輸入標準化為有效的鏈名稱
   * 支援鏈名稱或代幣符號作為輸入
   * @param input 輸入的鏈名稱或代幣符號
   * @returns 標準化的鏈名稱
   */
  private normalizeChainInput(input: string): ChainName {
    const lowercaseInput = input.toLowerCase();

    // 檢查是否為代幣符號，如果是則轉換為對應的鏈名稱
    if (COIN_SYMBOL_TO_CHAIN_MAP[lowercaseInput]) {
      return COIN_SYMBOL_TO_CHAIN_MAP[lowercaseInput];
    }

    // 如果輸入已經是有效的 ChainName，則直接轉換
    if (Object.values(ChainName).includes(lowercaseInput as ChainName)) {
      return lowercaseInput as ChainName;
    }

    throw new BlockchainException(
      ErrorCode.BLOCKCHAIN_INVALID_CHAIN,
      `Chain ${input} not supported`,
    );
  }

  async getPortfolio(chainNameOrSymbol: string, address: string) {
    const chain = this.normalizeChainInput(chainNameOrSymbol);

    // 1. 先从缓存获取 (使用標準化的鏈名稱作為鍵的一部分)
    const cacheKey = `portfolio:${chain}:${address}`;
    const cachedData = await this.cacheService.get(cacheKey);
    if (cachedData) {
      this.logger.debug(`Cache hit for key ${cacheKey}`);
      return cachedData;
    } else {
      this.logger.debug(`Cache miss for key ${cacheKey}`);
    }

    // 2. 使用提供者工廠獲取對應的區塊鏈提供者實例
    try {
      // 將 ChainName 轉換為 BlockchainType
      const blockchainType = this.mapChainNameToBlockchainType(chain);

      // 特別處理: 明確指定使用 ALCHEMY 提供者
      const provider = this.providerFactory.getProvider(blockchainType, ProviderType.ALCHEMY);

      this.logger.debug(`Using provider: ${provider.getProviderName()} for ${blockchainType}`);

      // 獲取區塊鏈配置
      const chainConfig = provider.getChainConfig();

      // 調用提供者的 getBalances 方法獲取餘額數據
      const balanceData = await provider.getBalances(address);

      // 檢查是否成功獲取餘額數據
      if (balanceData.isSuccess === false) {
        // 根據錯誤訊息分類拋出不同類型的異常
        const errorMsg = balanceData.errorMessage || '未知錯誤';

        if (errorMsg.includes('401 Unauthorized') || errorMsg.includes('Must be authenticated')) {
          throw new ProviderException(ErrorCode.PROVIDER_AUTH_FAILED, errorMsg);
        } else if (errorMsg.includes('Invalid') && errorMsg.includes('address')) {
          throw new BlockchainException(ErrorCode.BLOCKCHAIN_INVALID_ADDRESS, errorMsg);
        } else {
          throw new BalanceException(ErrorCode.BALANCE_FETCH_FAILED, errorMsg);
        }
      }

      // 3. 組裝結果數據
      const result = {
        chainId: chainConfig.chainId,
        chainName: chainConfig.name,
        native: {
          balance: balanceData.nativeBalance.balance,
          symbol: chainConfig.nativeSymbol,
          decimals: chainConfig.nativeDecimals,
        },
        fungibles: balanceData.tokens.map((token) => ({
          mint: token.mint,
          balance: token.balance,
          symbol: token.tokenMetadata?.symbol || 'Unknown',
          decimals: token.tokenMetadata?.decimals || 0,
          name: token.tokenMetadata?.name || 'Unknown Token',
        })),
        nfts: balanceData.nfts.map((nft) => ({
          mint: nft.mint,
          tokenId: nft.tokenId || '',
          name: nft.tokenMetadata?.name || 'Unknown NFT',
          collection: nft.tokenMetadata?.collection?.name || '',
          image: nft.tokenMetadata?.image || '',
        })),
        updatedAt: Math.floor(Date.now() / 1000),
      };

      // 只有成功獲取數據時才緩存結果
      await this.cacheService.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error(`Error fetching portfolio for ${chain}:${address}`, error);
      // 重新拋出錯誤，讓過濾器處理
      throw error;
    }
  }

  /**
   * 將 ChainName 映射到 BlockchainType
   * @param chainName 鏈名稱
   * @returns 區塊鏈類型
   */
  private mapChainNameToBlockchainType(chainName: ChainName): BlockchainType {
    const chainToBlockchainMap = {
      [ChainName.ETHEREUM]: BlockchainType.ETHEREUM,
      [ChainName.SOLANA]: BlockchainType.SOLANA,
      // 可以根據需要擴展更多映射
    };

    const blockchainType = chainToBlockchainMap[chainName];
    if (!blockchainType) {
      throw new BlockchainException(
        ErrorCode.BLOCKCHAIN_INVALID_CHAIN,
        `無法將 ${chainName} 映射到對應的區塊鏈類型`,
      );
    }

    return blockchainType;
  }
}
