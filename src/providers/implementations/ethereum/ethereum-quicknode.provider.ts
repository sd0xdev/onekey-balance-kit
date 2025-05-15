import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AbstractEthereumProviderService } from '../../abstract/abstract-ethereum-provider.service';
import { BalancesResponse, NetworkType } from '../../interfaces/blockchain-provider.interface';
import { EthereumTransactionRequest } from '../../interfaces/ethereum-provider.interface';
import { BlockchainType, ProviderType } from '../../constants/blockchain-types';
import { Provider } from '../../decorators/provider.decorator';
import { formatUnits, parseUnits } from 'ethers';
import { Core } from '@quicknode/sdk';

/**
 * QuickNode 以太坊提供者實現
 * 使用 QuickNode SDK 與 QuickNode endpoints 進行互動
 */
@Provider({
  blockchainType: BlockchainType.ETHEREUM,
  providerType: ProviderType.QUICKNODE,
})
@Injectable()
export class EthereumQuickNodeProvider extends AbstractEthereumProviderService {
  private ethereumMainnetClient: Core | null = null;
  private ethereumTestnetClient: Core | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
    this.initializeClients();
  }

  /**
   * 初始化 QuickNode 客戶端
   */
  private initializeClients(): void {
    // 初始化以太坊主網客戶端
    const ethMainnetEndpoint = this.configService.get<string>('QUICKNODE_ETH_MAINNET_URL');

    if (ethMainnetEndpoint) {
      try {
        this.ethereumMainnetClient = new Core({
          endpointUrl: ethMainnetEndpoint,
          // 啟用 NFT 和 Token API
          config: {
            addOns: {
              nftTokenV2: true,
            },
          },
        });
        this.logInfo('QuickNode Ethereum mainnet client initialized');
      } catch (error) {
        this.logError(`Failed to initialize QuickNode Ethereum mainnet client: ${error}`);
      }
    } else {
      this.logWarning('QuickNode Ethereum mainnet endpoint is not configured');
    }

    // 初始化以太坊測試網客戶端 (Sepolia)
    const ethTestnetEndpoint = this.configService.get<string>('QUICKNODE_ETH_TESTNET_URL');

    if (ethTestnetEndpoint) {
      try {
        this.ethereumTestnetClient = new Core({
          endpointUrl: ethTestnetEndpoint,
          // 啟用 NFT 和 Token API
          config: {
            addOns: {
              nftTokenV2: true,
            },
          },
        });
        this.logInfo('QuickNode Ethereum testnet client initialized');
      } catch (error) {
        this.logError(`Failed to initialize QuickNode Ethereum testnet client: ${error}`);
      }
    } else {
      this.logWarning('QuickNode Ethereum testnet endpoint is not configured');
    }
  }

  /**
   * 獲取以太坊客戶端
   * @param networkType 網絡類型
   */
  private getClient(networkType: NetworkType = NetworkType.MAINNET): Core | null {
    const isTestnet = networkType === NetworkType.TESTNET;

    if (isTestnet) {
      if (!this.ethereumTestnetClient) {
        this.logWarning(
          'QuickNode Ethereum testnet client not initialized, falling back to mainnet client',
        );
        return this.ethereumMainnetClient;
      }
      return this.ethereumTestnetClient;
    }

    return this.ethereumMainnetClient;
  }

  /**
   * 獲取提供者名稱
   */
  getProviderName(): string {
    return 'QuickNode';
  }

  /**
   * 檢查提供者是否支援
   */
  isSupported(): boolean {
    return !!this.ethereumMainnetClient;
  }

  /**
   * 獲取 QuickNode API 的基礎 URL
   * @param networkType 網絡類型
   */
  getBaseUrl(networkType: NetworkType = NetworkType.MAINNET): string {
    return networkType === NetworkType.TESTNET
      ? this.configService.get<string>('QUICKNODE_ETH_TESTNET_URL', '')
      : this.configService.get<string>('QUICKNODE_ETH_MAINNET_URL', '');
  }

  /**
   * 獲取 API 金鑰
   * 注意：QuickNode 端點 URL 已經包含了 API 金鑰，此方法返回空字符串
   */
  getApiKey(): string {
    return '';
  }

  /**
   * 獲取地址的以太坊餘額資訊
   * @param address 以太坊地址
   * @param networkType 網絡類型
   */
  async getBalances(
    address: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<BalancesResponse> {
    try {
      this.logInfo(
        `Getting balances for ${address} using QuickNode provider on ${networkType} network`,
      );

      // 檢查地址有效性
      if (!this.validateEthereumAddress(address)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
      }

      // 獲取 QuickNode 客戶端
      const client = this.getClient(networkType);

      if (!client) {
        throw new Error('QuickNode client not initialized');
      }

      // 獲取原生代幣餘額 - 使用標準 eth_getBalance 方法
      const ethAddress = this.ensureHexAddress(address);
      const nativeBalanceResult = await client.client.getBalance({
        address: ethAddress,
      });
      const nativeBalance = nativeBalanceResult.toString();

      // 嘗試使用 QuickNode Token API 擴展獲取代幣資訊
      let tokens: any[] = [];
      let nfts: any[] = [];

      try {
        // 使用擴展 API 方法
        const clientAny = client.client as any;

        // 獲取代幣餘額
        if (typeof clientAny.qn_fetchTokenBalances === 'function') {
          const tokenBalancesResponse = await clientAny.qn_fetchTokenBalances({
            wallet: address,
            contracts: [], // 空陣列獲取所有代幣
            perPage: 100, // 增加每頁數量
          });

          if (tokenBalancesResponse && Array.isArray(tokenBalancesResponse.tokens)) {
            tokens = tokenBalancesResponse.tokens.map((token: any) => ({
              contractAddress: token.address,
              symbol: token.symbol || '',
              name: token.name || token.symbol || '',
              balance: token.amount || '0',
              decimals: token.decimals || 18,
            }));
          }
        } else {
          // 使用基本方法獲取主流代幣餘額
          this.logInfo('QuickNode Token API not available, falling back to basic token list');
          tokens = await this.fetchBasicTokens(address, client);
        }

        // 獲取 NFT 資訊
        if (typeof clientAny.qn_fetchNFTs === 'function') {
          const nftsResponse = await clientAny.qn_fetchNFTs({
            wallet: address,
            perPage: 100,
            page: 1,
          });

          if (nftsResponse && Array.isArray(nftsResponse.assets)) {
            nfts = nftsResponse.assets.map((nft: any) => ({
              contractAddress: nft.collectionAddress,
              tokenId: nft.tokenId,
              name: nft.name || '',
              symbol: nft.collectionName || '',
              tokenURI: nft.imageUrl || '',
              // 新增更多信息
              standard: nft.collectionTokenType || 'ERC721',
              metadata: {
                image: nft.imageUrl || '',
                attributes: nft.traits || [],
              },
            }));
          }
        }
      } catch (error) {
        this.logError(`Error fetching additional token data: ${error}`);
        // 記錄錯誤但繼續處理，因為這些是非關鍵資料
      }

      return {
        nativeBalance: {
          balance: nativeBalance,
        },
        tokens,
        nfts,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get balances from QuickNode: ${errorMessage}`);

      // 拋出錯誤，讓調用者可以處理
      throw new Error(`QuickNode provider error: ${errorMessage}`);
    }
  }

  /**
   * 獲取基本代幣列表
   * 當 Token API 不可用時的後備方法
   */
  private async fetchBasicTokens(address: string, client: Core): Promise<any[]> {
    try {
      // 主流代幣列表 - 實際應用應從配置或API獲取
      const popularTokens = [
        {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          symbol: 'USDT',
          name: 'Tether',
          decimals: 6,
        },
        {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
        },
        {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          symbol: 'DAI',
          name: 'Dai Stablecoin',
          decimals: 18,
        },
        {
          address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
          symbol: 'WBTC',
          name: 'Wrapped BTC',
          decimals: 8,
        },
      ];

      const tokenPromises = popularTokens.map(async (token) => {
        try {
          // 使用 SDK 提供的 call 方法直接調用 ERC20 合約方法
          const balanceOfSelector = '0x70a08231'; // balanceOf 函數選擇器
          const paddedAddress = address.slice(2).padStart(64, '0');
          const data = `${balanceOfSelector}${paddedAddress}` as `0x${string}`;
          const tokenAddress = this.ensureHexAddress(token.address);

          const balanceResult = await client.client.call({
            to: tokenAddress,
            data,
          });

          // 將結果轉換為十進制
          const balanceHex = this.extractHexString(balanceResult);
          let balanceDec = '0';

          try {
            if (balanceHex && balanceHex.length > 0) {
              balanceDec = BigInt(`0x${balanceHex}`).toString();
            }
          } catch (error) {
            this.logError(`Failed to convert hex to BigInt: ${balanceHex}, error: ${error}`);
          }

          return {
            contractAddress: token.address,
            symbol: token.symbol,
            name: token.name,
            balance: balanceDec,
            decimals: token.decimals,
          };
        } catch (error) {
          // 如果特定代幣發生錯誤，跳過該代幣但不中斷整個過程
          this.logError(`Error fetching token ${token.symbol}: ${error}`);
          return null;
        }
      });

      const results = await Promise.all(tokenPromises);
      // 過濾掉失敗的代幣和餘額為0的代幣
      return results
        .filter((token) => token !== null && token.balance !== '0')
        .map((token) => token as any);
    } catch (error) {
      this.logError(`Failed to fetch basic tokens: ${error}`);
      return [];
    }
  }

  /**
   * 從各種回傳類型中提取十六進制字串
   * @param result 合約調用結果
   */
  private extractHexString(result: unknown): string {
    let hexString = '';

    if (typeof result === 'string') {
      const resultStr = result;
      if (resultStr.startsWith('0x')) {
        hexString = resultStr.slice(2);
      } else {
        const hexMatch = resultStr.match(/([0-9a-f]{40,})/i);
        if (hexMatch) {
          hexString = hexMatch[0];
        }
      }
    } else if (result) {
      const resultStr = JSON.stringify(result);
      const hexMatches = resultStr.match(/0x([0-9a-f]+)/gi);
      if (hexMatches && hexMatches.length > 0) {
        const longest = hexMatches.reduce((a, b) => (a.length > b.length ? a : b));
        hexString = longest.slice(2);
      } else {
        hexString = resultStr.replace(/[^0-9a-f]/gi, '');
      }
    }

    return hexString;
  }

  /**
   * 獲取以太坊 Gas 價格
   * @param networkType 網絡類型
   */
  async getGasPrice(networkType: NetworkType = NetworkType.MAINNET): Promise<string> {
    try {
      const client = this.getClient(networkType);

      if (!client) {
        throw new Error('QuickNode client not initialized');
      }

      const gasPrice = await client.client.getGasPrice();
      return gasPrice.toString();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get gas price: ${errorMessage}`);
      return parseUnits('50', 'gwei').toString();
    }
  }

  /**
   * 獲取詳細的 Gas 價格資訊
   * @param networkType 網絡類型
   */
  async getDetailedGasPrice(networkType: NetworkType = NetworkType.MAINNET): Promise<{
    gasPrice: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    formatted: {
      gasPrice: string;
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
    };
  }> {
    try {
      const client = this.getClient(networkType);

      if (!client) {
        throw new Error('QuickNode client not initialized');
      }

      // 獲取基本 gas 價格
      const gasPrice = await client.client.getGasPrice();

      // 對於 maxPriorityFeePerGas 和 maxFeePerGas，嘗試通過 RPC 調用獲取
      let maxPriorityFeePerGas = parseUnits('2', 'gwei').toString();
      let maxFeePerGas = parseUnits('60', 'gwei').toString();

      try {
        const clientAny = client.client as any;
        if (typeof clientAny.send === 'function') {
          const priorityFeeResult = await clientAny.send('eth_maxPriorityFeePerGas', []);
          if (priorityFeeResult) {
            maxPriorityFeePerGas = BigInt(priorityFeeResult).toString();
            maxFeePerGas = (BigInt(gasPrice.toString()) + BigInt(maxPriorityFeePerGas)).toString();
          }
        }
      } catch (error) {
        this.logError(`Error fetching fee data: ${error}`);
        // 繼續使用預設值
      }

      const gasPriceStr = gasPrice.toString();

      return {
        gasPrice: gasPriceStr,
        maxFeePerGas,
        maxPriorityFeePerGas,
        formatted: {
          gasPrice: formatUnits(gasPriceStr, 'gwei'),
          maxFeePerGas: formatUnits(maxFeePerGas, 'gwei'),
          maxPriorityFeePerGas: formatUnits(maxPriorityFeePerGas, 'gwei'),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get detailed gas price: ${errorMessage}`);

      const gasPrice = parseUnits('50', 'gwei').toString();
      const maxFeePerGas = parseUnits('60', 'gwei').toString();
      const maxPriorityFeePerGas = parseUnits('2', 'gwei').toString();

      return {
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        formatted: {
          gasPrice: '50',
          maxFeePerGas: '60',
          maxPriorityFeePerGas: '2',
        },
      };
    }
  }

  /**
   * 估算交易所需 Gas 數量
   * @param txData 交易資料
   * @param networkType 網絡類型
   */
  async estimateGas(
    txData: EthereumTransactionRequest,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<string> {
    try {
      const client = this.getClient(networkType);

      if (!client) {
        throw new Error('QuickNode client not initialized');
      }

      // 驗證必要的交易欄位
      if (!txData.from) {
        throw new Error('Transaction requires a valid "from" address');
      }

      // 構建交易物件
      const transaction: any = {
        from: this.ensureHexAddress(txData.from),
      };

      // 添加可選欄位
      if (txData.to) {
        transaction.to = this.ensureHexAddress(txData.to);
      }

      if (txData.data) {
        transaction.data = txData.data;
      }

      // 處理 value 字段
      if (txData.value) {
        const valueStr = typeof txData.value === 'number' ? txData.value.toString() : txData.value;
        transaction.value = valueStr.startsWith('0x')
          ? (valueStr as `0x${string}`)
          : `0x${BigInt(valueStr).toString(16)}`;
      } else {
        transaction.value = '0x0';
      }

      const estimatedGas = await client.client.estimateGas(transaction);
      return estimatedGas.toString();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to estimate gas: ${errorMessage}`);
      return '21000'; // 基本交易預設值
    }
  }

  /**
   * 獲取以太坊 ERC20 Token 餘額
   * @param address 錢包地址
   * @param contractAddress 代幣合約地址
   * @param networkType 網絡類型
   */
  async getErc20Balance(
    address: string,
    contractAddress: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<string> {
    try {
      if (
        !this.validateEthereumAddress(address) ||
        !this.validateEthereumAddress(contractAddress)
      ) {
        throw new Error('Invalid Ethereum address');
      }

      const client = this.getClient(networkType);

      if (!client) {
        throw new Error('QuickNode client not initialized');
      }

      // 嘗試使用 QuickNode Token API
      const clientAny = client.client as any;
      if (typeof clientAny.qn_fetchTokenBalances === 'function') {
        try {
          const response = await clientAny.qn_fetchTokenBalances({
            wallet: address,
            contracts: [contractAddress],
          });

          if (response && Array.isArray(response.tokens) && response.tokens.length > 0) {
            return response.tokens[0].amount || '0';
          }
        } catch (error) {
          this.logError(`Error using qn_fetchTokenBalances: ${error}`);
          // 繼續使用傳統方法
        }
      }

      // 使用傳統 ERC20 合約調用方法
      const balanceOfSelector = '0x70a08231'; // balanceOf 函數選擇器
      const paddedAddress = address.slice(2).padStart(64, '0');
      const data = `${balanceOfSelector}${paddedAddress}` as `0x${string}`;
      const contractAddr = this.ensureHexAddress(contractAddress);

      const balanceResult = await client.client.call({
        to: contractAddr,
        data,
      });

      // 使用抽取方法獲取十六進制字串
      const balanceHex = this.extractHexString(balanceResult);
      let balanceDec = '0';

      try {
        if (balanceHex && balanceHex.length > 0) {
          balanceDec = BigInt(`0x${balanceHex}`).toString();
        }
      } catch (error) {
        this.logError(`Failed to convert hex to BigInt: ${balanceHex}, error: ${error}`);
        throw new Error(`ERC20 balance conversion error: ${error}`);
      }

      return balanceDec;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get ERC20 balance: ${errorMessage}`);
      throw new Error(`Failed to get ERC20 balance: ${errorMessage}`);
    }
  }

  /**
   * 獲取以太坊 ERC721 NFT 資訊
   * @param address 錢包地址
   * @param contractAddress NFT 合約地址（可選）
   * @param networkType 網絡類型
   */
  async getErc721Tokens(
    address: string,
    contractAddress?: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<any[]> {
    try {
      if (!this.validateEthereumAddress(address)) {
        throw new Error('Invalid Ethereum address');
      }

      const client = this.getClient(networkType);

      if (!client) {
        throw new Error('QuickNode client not initialized');
      }

      // 使用 QuickNode SDK 擴展方法
      const clientAny = client.client as any;

      // 檢查是否有 NFT API 擴展可用
      if (typeof clientAny.qn_fetchNFTs === 'function') {
        const params: any = {
          wallet: address,
          perPage: 100,
          page: 1,
        };

        // 如果指定了合約地址，添加到參數中
        if (contractAddress) {
          if (!this.validateEthereumAddress(contractAddress)) {
            throw new Error('Invalid NFT contract address');
          }
          params.contracts = [contractAddress];
        }

        const nftsResponse = await clientAny.qn_fetchNFTs(params);

        if (nftsResponse && Array.isArray(nftsResponse.assets)) {
          return nftsResponse.assets.map((nft: any) => ({
            contractAddress: nft.collectionAddress,
            tokenId: nft.tokenId,
            name: nft.name || '',
            symbol: nft.collectionName || '',
            tokenURI: nft.imageUrl || '',
            standard: nft.collectionTokenType || 'ERC721',
            metadata: {
              image: nft.imageUrl || '',
              attributes: nft.traits || [],
            },
          }));
        }

        return [];
      } else {
        this.logInfo('QuickNode NFT API not available, using basic balance check');

        // 使用基本的合約調用（當 NFT API 不可用時）
        if (contractAddress) {
          if (!this.validateEthereumAddress(contractAddress)) {
            throw new Error('Invalid NFT contract address');
          }

          // 獲取 NFT 餘額
          const balanceOfSelector = '0x70a08231'; // balanceOf 函數選擇器
          const paddedAddress = address.slice(2).padStart(64, '0');
          const data = `${balanceOfSelector}${paddedAddress}` as `0x${string}`;
          const nftContract = this.ensureHexAddress(contractAddress);

          const balanceResult = await client.client.call({
            to: nftContract,
            data,
          });

          // 使用抽取方法獲取十六進制字串
          const balanceHex = this.extractHexString(balanceResult);
          const balance = balanceHex ? parseInt(`0x${balanceHex}`, 16) : 0;

          if (balance === 0) {
            return [];
          }

          // 嘗試獲取名稱和符號
          let name = 'Unknown NFT';
          let symbol = '';

          try {
            // name() 函數選擇器
            const nameData = '0x06fdde03' as `0x${string}`;
            const nameResult = await client.client.call({
              to: nftContract,
              data: nameData,
            });
            name = this.hexToString(
              typeof nameResult === 'string' ? nameResult : JSON.stringify(nameResult),
            );
          } catch {
            // 忽略錯誤
          }

          try {
            // symbol() 函數選擇器
            const symbolData = '0x95d89b41' as `0x${string}`;
            const symbolResult = await client.client.call({
              to: nftContract,
              data: symbolData,
            });
            symbol = this.hexToString(
              typeof symbolResult === 'string' ? symbolResult : JSON.stringify(symbolResult),
            );
          } catch {
            // 忽略錯誤
          }

          // 返回簡化資訊
          return [
            {
              contractAddress,
              tokenId: 'unknown',
              name,
              symbol,
              tokenURI: '',
              message: `Address owns ${balance} NFTs from this contract, but tokenIds are not available without NFT API`,
            },
          ];
        } else {
          this.logWarning(
            'Listing all NFTs requires QuickNode NFT API, please specify a contract address',
          );
          return [
            {
              message:
                'Listing all NFTs requires QuickNode NFT API, please specify a contract address',
            },
          ];
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get ERC721 tokens: ${errorMessage}`);
      throw new Error(`Failed to get ERC721 tokens: ${errorMessage}`);
    }
  }

  /**
   * 獲取 NFT 交易歷史 (使用 Token and NFT API v2 bundle)
   * @param contractAddress NFT 合約地址
   * @param tokenId NFT 代幣 ID
   * @param networkType 網絡類型
   */
  async getNFTTransferHistory(
    contractAddress: string,
    tokenId: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<any[]> {
    try {
      if (!this.validateEthereumAddress(contractAddress)) {
        throw new Error('Invalid NFT contract address');
      }

      const client = this.getClient(networkType);

      if (!client) {
        throw new Error('QuickNode client not initialized');
      }

      const clientAny = client.client as any;
      if (typeof clientAny.qn_getTransfersByNFT !== 'function') {
        throw new Error('NFT API method qn_getTransfersByNFT not available');
      }

      const response = await clientAny.qn_getTransfersByNFT({
        collection: contractAddress,
        tokenId,
      });

      if (response && Array.isArray(response.transfers)) {
        return response.transfers.map((transfer: any) => ({
          from: transfer.from,
          to: transfer.to,
          txHash: transfer.transactionHash,
          blockNumber: transfer.blockNumber,
          timestamp: transfer.blockTimestamp || '',
        }));
      }

      return [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get NFT transfer history: ${errorMessage}`);
      throw new Error(`Failed to get NFT transfer history: ${errorMessage}`);
    }
  }

  /**
   * 獲取智能合約 ABI (使用 Token and NFT API v2 bundle)
   * @param contractAddress 合約地址
   * @param networkType 網絡類型
   */
  async getContractABI(
    contractAddress: string,
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<any> {
    try {
      if (!this.validateEthereumAddress(contractAddress)) {
        throw new Error('Invalid contract address');
      }

      const client = this.getClient(networkType);

      if (!client) {
        throw new Error('QuickNode client not initialized');
      }

      const clientAny = client.client as any;
      if (typeof clientAny.qn_getContractABI !== 'function') {
        throw new Error('API method qn_getContractABI not available');
      }

      const response = await clientAny.qn_getContractABI({
        contract: contractAddress,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Failed to get contract ABI: ${errorMessage}`);
      throw new Error(`Failed to get contract ABI: ${errorMessage}`);
    }
  }

  /**
   * 將十六進制字串轉換為 UTF-8 字符串
   */
  private hexToString(hexStr: string): string {
    try {
      // 移除 0x 前綴
      if (hexStr.startsWith('0x')) {
        hexStr = hexStr.slice(2);
      }

      // 前 64 字符（32 字節）是動態數據偏移量和長度
      // 通常字符串是從第 64 位開始
      if (hexStr.length >= 128) {
        // 取出長度部分
        const lengthHex = hexStr.slice(64, 128);
        const length = parseInt(lengthHex, 16);

        // 取出實際字符串數據部分
        const dataHex = hexStr.slice(128, 128 + length * 2);

        // 轉換為 UTF-8 字符串
        let result = '';
        for (let i = 0; i < dataHex.length; i += 2) {
          result += String.fromCharCode(parseInt(dataHex.substr(i, 2), 16));
        }
        return result;
      }

      // 簡單情況，直接轉換
      let result = '';
      for (let i = 0; i < hexStr.length; i += 2) {
        const hexByte = hexStr.substr(i, 2);
        if (hexByte === '00') continue; // 跳過空字節
        result += String.fromCharCode(parseInt(hexByte, 16));
      }
      return result;
    } catch (error) {
      this.logError(`Failed to convert hex to string: ${error}`);
      return '';
    }
  }

  /**
   * 確保地址格式為 0x 前綴的十六進制字符串
   * @param address 以太坊地址
   */
  private ensureHexAddress(address?: string): `0x${string}` {
    if (!address) {
      return '0x' as `0x${string}`;
    }

    // 如果已經是 0x 前綴的格式，直接返回
    if (address.startsWith('0x')) {
      return address as `0x${string}`;
    }

    // 添加 0x 前綴
    return `0x${address}`;
  }
}
