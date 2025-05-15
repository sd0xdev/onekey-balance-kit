import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';
import { AbstractSolanaProviderService } from '../../abstract/abstract-solana-provider.service';
import { BalancesResponse, NetworkType } from '../../interfaces/blockchain-provider.interface';
import { SolanaTransactionRequest } from '../../interfaces/solana-provider.interface';
import { BlockchainType, ProviderType } from '../../constants/blockchain-types';
import { Provider } from '../../decorators/provider.decorator';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

/**
 * Solana Alchemy 提供者實現
 */
@Provider({
  blockchainType: BlockchainType.SOLANA,
  providerType: ProviderType.ALCHEMY,
})
@Injectable()
export class SolanaAlchemyProvider extends AbstractSolanaProviderService {
  private solanaMainnetConnection: Connection;
  private solanaDevnetConnection: Connection;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    super();
    this.initializeConnections();
  }

  /**
   * 初始化 Solana 連接
   */
  private initializeConnections(): void {
    // 初始化 Solana 主網連接
    const solMainnetApiKey =
      this.configService.get<string>('ALCHEMY_API_KEY_SOL_MAINNET') ||
      this.configService.get<string>('ALCHEMY_API_KEY_SOL');

    if (solMainnetApiKey) {
      const mainnetUrl = `https://solana-mainnet.g.alchemy.com/v2/${solMainnetApiKey}`;
      this.solanaMainnetConnection = new Connection(mainnetUrl, 'confirmed');
      this.logInfo('Solana mainnet connection initialized');
    } else {
      this.logWarning('Solana mainnet API key is not configured');
    }

    // 初始化 Solana 測試網連接
    const solDevnetApiKey =
      this.configService.get<string>('ALCHEMY_API_KEY_SOL_TESTNET') ||
      this.configService.get<string>('ALCHEMY_API_KEY_SOL');

    if (solDevnetApiKey) {
      // 對於 devnet，可以使用 Alchemy 的 devnet 端點或 Solana 的公共 devnet
      // 如果 Alchemy 支持 devnet
      const devnetUrl = `https://solana-devnet.g.alchemy.com/v2/${solDevnetApiKey}`;

      // 如果 Alchemy 不支持 devnet，使用 Solana 官方端點
      // const devnetUrl = clusterApiUrl('devnet');

      this.solanaDevnetConnection = new Connection(devnetUrl, 'confirmed');
      this.logInfo('Solana devnet connection initialized');
    } else {
      this.logWarning('Solana devnet API key is not configured');
      // 使用 Solana 官方 devnet 作為後備
      this.solanaDevnetConnection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      this.logInfo('Fallback to Solana official devnet');
    }
  }

  /**
   * 獲取適當的 Solana Connection 實例
   * @param networkType 網絡類型
   * @returns Connection 實例
   */
  private getConnection(networkType: NetworkType = NetworkType.MAINNET): Connection {
    const isTestnet = networkType === NetworkType.TESTNET;

    if (isTestnet) {
      if (!this.solanaDevnetConnection) {
        this.logWarning(
          'Solana devnet connection not initialized, falling back to mainnet connection',
        );
        return this.solanaMainnetConnection;
      }
      return this.solanaDevnetConnection;
    }

    return this.solanaMainnetConnection;
  }

  /**
   * 獲取提供者名稱
   */
  getProviderName(): string {
    return 'Alchemy';
  }

  /**
   * 檢查提供者是否支援
   */
  isSupported(): boolean {
    return !!this.solanaMainnetConnection;
  }

  /**
   * 獲取 Alchemy API 的基礎 URL
   * @param networkType 網絡類型
   */
  getBaseUrl(networkType: string = NetworkType.MAINNET.toString()): string {
    const network =
      networkType === NetworkType.TESTNET.toString() ? 'solana-devnet' : 'solana-mainnet';
    return `https://${network}.g.alchemy.com/v2/`;
  }

  /**
   * 獲取 Alchemy API 密鑰
   * @param networkType 網絡類型
   */
  getApiKey(networkType: string = NetworkType.MAINNET.toString()): string {
    const keyEnvVar =
      networkType === NetworkType.TESTNET.toString()
        ? 'ALCHEMY_API_KEY_SOL_TESTNET'
        : 'ALCHEMY_API_KEY_SOL_MAINNET';

    const fallbackKeyEnvVar = 'ALCHEMY_API_KEY_SOL';

    return (
      this.configService.get<string>(keyEnvVar) ||
      this.configService.get<string>(fallbackKeyEnvVar, '')
    );
  }

  /**
   * 獲取地址的 Solana 餘額資訊
   * @param address Solana 地址
   * @param networkType 網絡類型
   */
  async getBalances(
    address: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<BalancesResponse> {
    try {
      this.logInfo(
        `Getting balances for ${address} using Alchemy provider on ${networkType} network`,
      );

      // 驗證地址
      if (!this.validateSolanaAddress(address)) {
        throw new Error(`Invalid Solana address: ${address}`);
      }

      const connection = this.getConnection(networkType);
      if (!connection) {
        throw new Error('Solana connection not initialized');
      }

      // 創建公鑰
      const publicKey = new PublicKey(address);

      // 獲取 SOL 餘額
      const solBalance = await connection.getBalance(publicKey);

      // 獲取所有代幣賬戶
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), // Token Program ID
      });

      // 格式化代幣餘額
      const tokens = tokenAccounts.value.map((tokenAccount) => {
        const { mint, tokenAmount } = tokenAccount.account.data.parsed.info;
        const { amount, decimals } = tokenAmount;

        return {
          mint,
          tokenMetadata: {
            symbol: this.getMintSymbol(mint), // 這個方法需要額外實現或從緩存獲取
            decimals: decimals,
          },
          balance: amount,
        };
      });

      // 獲取 NFT (Metaplex)
      // 這需要使用 Metaplex 或 Alchemy API 來獲取
      // 下面是通過 Alchemy API 獲取 NFT 的示例
      const nfts = await this.getNftsForOwner(address, networkType);

      return {
        nativeBalance: {
          balance: solBalance.toString(),
        },
        tokens,
        nfts,
        isSuccess: true,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get balances from Alchemy: ${errorMessage}`);

      // 返回帶有失敗標誌的結果
      return {
        nativeBalance: {
          balance: '0',
        },
        tokens: [],
        nfts: [],
        isSuccess: false,
        errorMessage: errorMessage,
      };
    }
  }

  /**
   * 獲取代幣符號（這需要從某個地方獲取或緩存）
   * @param mintAddress 代幣鑄造地址
   */
  private getMintSymbol(_mintAddress: string): string {
    // 這裡應該實現獲取代幣符號的邏輯
    // 可以通過 API、緩存或本地映射獲取
    // 暫時返回 "Unknown"
    return 'Unknown';
  }

  /**
   * 使用 Alchemy API 獲取地址擁有的 NFT
   * @param address 錢包地址
   * @param networkType 網絡類型
   */
  private async getNftsForOwner(address: string, networkType: NetworkType): Promise<any[]> {
    try {
      const apiKey = this.getApiKey(networkType.toString());
      const baseUrl = this.getBaseUrl(networkType.toString());

      // 使用 HttpService 獲取 NFT
      const response: AxiosResponse<any> = await lastValueFrom(
        this.httpService.post(`${baseUrl}${apiKey}`, {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenMetadata', // 或者是 Alchemy 提供的其他 Solana NFT 方法
          params: [address],
        }),
      );

      // 這裡需要根據 Alchemy 的 Solana API 響應結構進行處理
      // 由於缺乏具體的 API 結構資訊，下面是一個模擬的處理邏輯
      if (response.data && response.data.result) {
        return response.data.result.map((nft: any) => ({
          mint: nft.mint,
          tokenId: nft.tokenId || '',
          tokenMetadata: {
            name: nft.name || 'Unknown NFT',
            image: nft.image || '',
            collection: {
              name: nft.collection?.name || 'Unknown Collection',
            },
          },
        }));
      }

      return [];
    } catch (error) {
      this.logError(`Failed to get NFTs: ${error}`);
      return [];
    }
  }

  /**
   * 獲取 Solana 近期區塊雜湊值
   * @param networkType 網絡類型
   */
  async getRecentBlockhash(networkType: NetworkType = NetworkType.MAINNET): Promise<string> {
    try {
      const connection = this.getConnection(networkType);
      const { blockhash } = await connection.getLatestBlockhash();
      return blockhash;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get recent blockhash: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 獲取 SPL Token 餘額
   * @param address 錢包地址
   * @param mintAddress 代幣鑄造地址
   * @param networkType 網絡類型
   */
  async getSplTokenBalance(
    address: string,
    mintAddress: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<string> {
    try {
      const connection = this.getConnection(networkType);
      const ownerPublicKey = new PublicKey(address);
      const mintPublicKey = new PublicKey(mintAddress);

      // 獲取指定代幣的賬戶
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
        mint: mintPublicKey,
      });

      // 如果找到賬戶，返回餘額
      if (tokenAccounts.value.length > 0) {
        const tokenAccount = tokenAccounts.value[0];
        const { amount } = tokenAccount.account.data.parsed.info.tokenAmount;
        return amount;
      }

      return '0';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get SPL token balance: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 獲取 Solana NFT 資訊 (包括 Metaplex 標準)
   * @param address 錢包地址
   * @param collection 集合地址 (可選)
   * @param networkType 網絡類型
   */
  async getNfts(
    address: string,
    collection?: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<any[]> {
    try {
      // 使用 Alchemy API 獲取 NFT，與前面的 getNftsForOwner 方法類似
      // 但可以添加對集合的過濾
      const apiKey = this.getApiKey(networkType.toString());
      const baseUrl = this.getBaseUrl(networkType.toString());

      const params: any[] = [address];
      if (collection) {
        // 如果指定了集合，添加到參數中
        params.push({ collection });
      }

      const response: AxiosResponse<any> = await lastValueFrom(
        this.httpService.post(`${baseUrl}${apiKey}`, {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getNfts', // 假設 Alchemy 有這個方法
          params,
        }),
      );

      if (response.data && response.data.result) {
        return response.data.result;
      }

      return [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get NFTs: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 獲取 Solana 帳戶資訊
   * @param address 帳戶地址
   * @param networkType 網絡類型
   */
  async getAccountInfo(
    address: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<any> {
    try {
      const connection = this.getConnection(networkType);
      const publicKey = new PublicKey(address);

      const accountInfo = await connection.getAccountInfo(publicKey);
      return accountInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get account info: ${errorMessage}`);
      throw error;
    }
  }
}
