import { BalanceStrategy } from '../balance-strategy.interface';
import { NetworkType } from '../../interfaces/blockchain-provider.interface';

/**
 * Solana Alchemy 策略 - 處理與 Solana 鏈上 Alchemy 節點或 Portfolio API 的通訊
 */
export class SolanaAlchemyStrategy implements BalanceStrategy {
  private readonly baseUrl: string;

  /**
   * 建構子
   * @param apiKey Alchemy API 金鑰
   * @param isDevnet 是否為開發網
   */
  constructor(
    private readonly apiKey: string,
    private readonly isDevnet: boolean = false,
  ) {
    // 根據網路類型選擇 API 基礎 URL
    this.baseUrl = isDevnet
      ? 'https://solana-devnet.g.alchemy.com/v2/'
      : 'https://solana-mainnet.g.alchemy.com/v2/';
  }

  /**
   * 日誌記錄 - 信息級別
   * @param message 日誌消息
   */
  private logInfo(message: string): void {
    console.info(`[SolanaAlchemyStrategy] INFO: ${message}`);
  }

  /**
   * 日誌記錄 - 警告級別
   * @param message 日誌消息
   */
  private logWarning(message: string): void {
    console.warn(`[SolanaAlchemyStrategy] WARNING: ${message}`);
  }

  /**
   * 日誌記錄 - 錯誤級別
   * @param message 日誌消息
   */
  private logError(message: string): void {
    console.error(`[SolanaAlchemyStrategy] ERROR: ${message}`);
  }

  /**
   * 執行 Solana JSON-RPC 調用
   * @param method RPC 方法名稱
   * @param params 方法參數
   * @returns RPC 響應
   */
  private async rpcCall<T>(method: string, params: any[] = []): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(`Solana RPC error: ${JSON.stringify(data.error)}`);
      }

      return data.result;
    } catch (error) {
      this.logError(`RPC call failed: ${error}`);
      throw error;
    }
  }

  /**
   * 調用 Alchemy Portfolio API
   * @param endpoint API 端點
   * @param queryParams 查詢參數
   * @returns API 響應
   */
  private async portfolioApiCall<T>(
    endpoint: string,
    queryParams: Record<string, string> = {},
  ): Promise<T> {
    try {
      const url = new URL(`https://solana-mainnet.g.alchemy.com/nft/v3/${this.apiKey}/${endpoint}`);

      // 添加查詢參數
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      });

      const data = await response.json();

      if (response.status >= 400) {
        throw new Error(`Portfolio API error: ${data.error || response.statusText}`);
      }

      return data;
    } catch (error) {
      this.logError(`Portfolio API call failed: ${error}`);
      throw error;
    }
  }

  /**
   * 獲取原始餘額資料
   * @param address 錢包地址
   * @param networkType 網路類型
   */
  async getRawBalances(address: string, networkType: NetworkType): Promise<any> {
    try {
      // 獲取 SOL 餘額
      const solBalanceResponse = await this.rpcCall<{ value: number }>('getBalance', [address]);
      const solBalance = solBalanceResponse.value.toString();

      // 獲取代幣賬戶
      const tokenAccountsResponse = await this.rpcCall<{
        value: Array<{
          pubkey: string;
          account: {
            data: {
              parsed: {
                info: {
                  mint: string;
                  amount: string;
                  decimals: number;
                };
              };
            };
            executable: boolean;
            lamports: number;
            owner: string;
            rentEpoch: number;
          };
        }>;
      }>('getTokenAccountsByOwner', [
        address,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ]);

      // 解析代幣賬戶數據
      const tokenAccounts = await Promise.all(
        tokenAccountsResponse.value.map(async (account) => {
          // 使用正確的 JSON 解析結構
          const parsedData = account.account.data.parsed.info;
          const mint = parsedData.mint || '';
          const amount = parsedData.amount || '0';
          const decimals = parsedData.decimals || 0;

          // 獲取代幣元數據
          let symbol = '';
          let name = '';
          try {
            // 這裡可以通過另一個 RPC 調用獲取代幣元數據
            // 在實際實現中應進行批量查詢以提高效率
            const metadataUri = await this.getMintMetadataUri(mint);
            if (metadataUri) {
              const metadataResponse = await fetch(metadataUri);
              const metadata = await metadataResponse.json();
              symbol = metadata.symbol || '';
              name = metadata.name || '';
            }
          } catch (error) {
            this.logWarning(`Failed to fetch token metadata for ${mint}: ${error}`);
          }

          return {
            mint,
            amount,
            decimals,
            uiAmount: parseInt(amount) / Math.pow(10, decimals),
            symbol,
            name,
          };
        }),
      );

      // 獲取 NFT - 使用 Alchemy Portfolio API
      const nftsResponse = await this.portfolioApiCall<{
        ownedNfts: Array<{
          contract: { address: string };
          id: { tokenId: string };
          name: string;
          image: { originalUrl: string };
          collection: { name: string };
        }>;
      }>('getNFTs', { owner: address, withMetadata: 'true' });

      const nfts = nftsResponse.ownedNfts.map((nft) => ({
        mint: nft.contract.address,
        name: nft.name,
        image: nft.image?.originalUrl,
        collectionName: nft.collection?.name,
      }));

      return {
        solBalance,
        tokenAccounts,
        nfts,
      };
    } catch (error) {
      this.logError(`Failed to get Solana balances: ${error}`);
      throw error;
    }
  }

  /**
   * 獲取代幣元數據 URI
   * @param mint 代幣 mint 地址
   * @returns 元數據 URI 或 null
   */
  private async getMintMetadataUri(mint: string): Promise<string | null> {
    try {
      // 根據 Solana 代幣元數據標準建構元數據地址
      // 這裡簡化處理，實際應用中應使用 @metaplex-foundation/js 等庫
      const metadataResponse = await this.rpcCall<any>('getProgramAccounts', [
        'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', // Metadata Program ID
        {
          filters: [
            { dataSize: 679 }, // 元數據賬戶大小
            {
              memcmp: {
                offset: 33,
                bytes: mint,
              },
            },
          ],
        },
      ]);

      if (metadataResponse.length > 0) {
        const metadataAccount = metadataResponse[0];
        // 從元數據賬戶中解析 URI
        // 實際實現中需要根據元數據結構解析
        const uri = metadataAccount.account.data.uri || '';
        return uri;
      }

      return null;
    } catch (error) {
      this.logWarning(`Failed to get metadata URI for ${mint}: ${error}`);
      return null;
    }
  }

  /**
   * 獲取原始 Gas 價格資料
   * @param networkType 網路類型
   */
  async getRawGasPrice(networkType: NetworkType): Promise<any> {
    try {
      // 獲取近期的區塊哈希並解析費用
      const response = await this.rpcCall<{
        feeCalculator: { lamportsPerSignature: number };
        blockhash: string;
        lastValidBlockHeight: number;
      }>('getRecentBlockhash', []);

      return {
        lamportsPerSignature: response.feeCalculator.lamportsPerSignature,
      };
    } catch (error) {
      this.logError(`Failed to get Solana gas price: ${error}`);
      throw error;
    }
  }

  /**
   * 估算交易所需 Gas
   * @param txData 交易資料
   * @param networkType 網路類型
   */
  async getRawEstimateGas(txData: { message: string }, networkType: NetworkType): Promise<any> {
    try {
      // 使用模擬交易 API 估算費用
      const response = await this.rpcCall<{
        err: any;
        logs: string[];
        unitsConsumed?: number;
      }>('simulateTransaction', [txData.message]);

      return {
        lamportsUsed: response.unitsConsumed || 0,
      };
    } catch (error) {
      this.logError(`Failed to estimate Solana gas: ${error}`);
      throw error;
    }
  }
}
