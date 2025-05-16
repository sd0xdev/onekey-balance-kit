import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Alchemy, Network, TokenBalanceType } from 'alchemy-sdk';
import { EthereumAlchemyProvider } from './ethereum-alchemy.provider';
import { NetworkType } from '../../interfaces/blockchain-provider.interface';
import { EthereumTransactionRequest } from '../../interfaces/ethereum-provider.interface';

// 模擬 Alchemy SDK
jest.mock('alchemy-sdk', () => {
  const originalModule = jest.requireActual('alchemy-sdk');

  // 創建模擬客戶端工廠函數 (在這裡定義，而不是外部)
  const createMockAlchemyClient = () => ({
    core: {
      getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
      getTokenBalances: jest.fn().mockResolvedValue({
        tokenBalances: [
          {
            contractAddress: '0xToken1',
            tokenBalance: '1000000000000000000',
          },
          {
            contractAddress: '0xToken2',
            tokenBalance: '2000000000000000000',
          },
        ],
      }),
      getTokenMetadata: jest.fn().mockImplementation((contractAddress) => {
        if (contractAddress === '0xToken1') {
          return {
            symbol: 'TKN1',
            decimals: 18,
            name: 'Token One',
          };
        } else if (contractAddress === '0xToken2') {
          return {
            symbol: 'TKN2',
            decimals: 18,
            name: 'Token Two',
          };
        }
        return null;
      }),
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: '20000000000',
        maxFeePerGas: '25000000000',
        maxPriorityFeePerGas: '2000000000',
      }),
      estimateGas: jest.fn().mockResolvedValue('21000'),
    },
    nft: {
      getNftsForOwner: jest.fn().mockResolvedValue({
        ownedNfts: [
          {
            contract: {
              address: '0xNFT1',
              name: 'NFT Collection 1',
            },
            tokenId: '123',
            raw: {
              metadata: {
                name: 'NFT One',
                image: 'https://example.com/nft1.png',
              },
            },
          },
        ],
      }),
    },
  });

  // 創建兩個模擬客戶端，用於主網和測試網
  const mockMainnetClient = createMockAlchemyClient();
  const mockTestnetClient = createMockAlchemyClient();

  let callCount = 0;

  return {
    ...originalModule,
    Alchemy: jest.fn().mockImplementation(() => {
      // 第一次調用返回主網客戶端，第二次調用返回測試網客戶端
      callCount++;
      return callCount === 1 ? mockMainnetClient : mockTestnetClient;
    }),
    Network: {
      ETH_MAINNET: 'eth-mainnet',
      ETH_SEPOLIA: 'eth-sepolia',
    },
    TokenBalanceType: {
      ERC20: 'erc20',
    },
  };
});

// 模擬 ConfigService
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
    const config: { [key: string]: string } = {
      ALCHEMY_API_KEY_ETH_MAINNET: 'test-mainnet-api-key',
      ALCHEMY_API_KEY_ETH_TESTNET: 'test-testnet-api-key',
    };
    return config[key] || defaultValue;
  }),
};

describe('EthereumAlchemyProvider', () => {
  let provider: EthereumAlchemyProvider;
  let mainnetClientMock: any;
  let testnetClientMock: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EthereumAlchemyProvider,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    provider = module.get<EthereumAlchemyProvider>(EthereumAlchemyProvider);

    // 獲取 Alchemy 構造函數的模擬實例
    // 注意 mock.results 數組中，0是主網客戶端，1是測試網客戶端
    mainnetClientMock = (Alchemy as jest.Mock).mock.results[0].value;
    testnetClientMock = (Alchemy as jest.Mock).mock.results[1].value;
  });

  it('應該被定義', () => {
    expect(provider).toBeDefined();
  });

  describe('初始化', () => {
    it('應該使用正確的配置初始化以太坊主網客戶端', () => {
      expect(Alchemy).toHaveBeenCalledWith({
        apiKey: 'test-mainnet-api-key',
        network: Network.ETH_MAINNET,
      });
    });

    it('應該使用正確的配置初始化以太坊測試網客戶端', () => {
      expect(Alchemy).toHaveBeenCalledWith({
        apiKey: 'test-testnet-api-key',
        network: Network.ETH_SEPOLIA,
      });
    });
  });

  describe('getProviderName', () => {
    it('應該返回正確的提供者名稱', () => {
      expect(provider.getProviderName()).toBe('Alchemy');
    });
  });

  describe('isSupported', () => {
    it('當API密鑰存在並且客戶端初始化成功時，應該返回true', () => {
      // 在這個例子中，我們已經在 beforeEach 中設置了客戶端和 API 密鑰
      const result = provider.isSupported();
      expect(result).toBe(true);
    });

    it('當API密鑰不存在時，應該返回false', () => {
      // 直接設置 chainClients 的大小為 0
      const originalMap = (provider as any).chainClients;
      (provider as any).chainClients = new Map();

      expect(provider.isSupported()).toBe(false);

      // 恢復原始值
      (provider as any).chainClients = originalMap;
    });
  });

  describe('getBaseUrl', () => {
    it('應該返回正確的主網基礎URL', () => {
      expect(provider.getBaseUrl(NetworkType.MAINNET.toString())).toBe(
        'https://eth-mainnet.g.alchemy.com/v2/',
      );
    });

    it('應該返回正確的測試網基礎URL', () => {
      expect(provider.getBaseUrl(NetworkType.TESTNET.toString())).toBe(
        'https://eth-sepolia.g.alchemy.com/v2/',
      );
    });
  });

  describe('getApiKey', () => {
    it('應該返回正確的主網API密鑰', () => {
      expect(provider.getApiKey(NetworkType.MAINNET.toString())).toBe('test-mainnet-api-key');
    });

    it('應該返回正確的測試網API密鑰', () => {
      expect(provider.getApiKey(NetworkType.TESTNET.toString())).toBe('test-testnet-api-key');
    });
  });

  describe('getBalances', () => {
    const address = '0x1234567890123456789012345678901234567890';

    beforeEach(() => {
      // 模擬 getBalance 返回 1 ETH
      mainnetClientMock.core.getBalance.mockResolvedValue('1000000000000000000');

      // 模擬 getTokenBalances 返回代幣
      mainnetClientMock.core.getTokenBalances.mockResolvedValue({
        tokenBalances: [
          {
            contractAddress: '0xToken1',
            tokenBalance: '2000000000000000000',
          },
        ],
      });

      // 模擬 getTokenMetadata 返回代幣元數據
      mainnetClientMock.core.getTokenMetadata.mockResolvedValue({
        symbol: 'TKN',
        decimals: 18,
        name: 'Test Token',
      });

      // 模擬 getNftsForOwner 返回 NFT
      mainnetClientMock.nft.getNftsForOwner.mockResolvedValue({
        ownedNfts: [
          {
            contract: { address: '0xNFT1', name: 'NFT Collection 1' },
            tokenId: '123',
            raw: {
              metadata: {
                name: 'NFT One',
                image: 'https://example.com/nft1.png',
              },
            },
          },
        ],
      });

      // 對測試網客戶端進行相同的模擬設置
      testnetClientMock.core.getBalance.mockResolvedValue('1000000000000000000');
      testnetClientMock.core.getTokenBalances.mockResolvedValue({
        tokenBalances: [
          {
            contractAddress: '0xToken1',
            tokenBalance: '2000000000000000000',
          },
        ],
      });
      testnetClientMock.core.getTokenMetadata.mockResolvedValue({
        symbol: 'TKN',
        decimals: 18,
        name: 'Test Token',
      });
      testnetClientMock.nft.getNftsForOwner.mockResolvedValue({
        ownedNfts: [
          {
            contract: { address: '0xNFT1', name: 'NFT Collection 1' },
            tokenId: '123',
            raw: {
              metadata: {
                name: 'NFT One',
                image: 'https://example.com/nft1.png',
              },
            },
          },
        ],
      });
    });

    it('應該返回正確的餘額', async () => {
      const result = await provider.getBalances(address);

      // 驗證原生代幣餘額
      expect(result.nativeBalance.balance).toBe('1000000000000000000');

      // 驗證 ERC20 代幣
      expect(result.tokens).toEqual([
        {
          mint: '0xToken1',
          tokenMetadata: {
            symbol: 'TKN',
            decimals: 18,
            name: 'Test Token',
          },
          balance: '2000000000000000000',
        },
      ]);

      // 驗證 NFT
      expect(result.nfts).toEqual([
        {
          mint: '0xNFT1',
          tokenId: '123',
          tokenMetadata: {
            name: 'NFT One',
            image: 'https://example.com/nft1.png',
            collection: {
              name: 'NFT Collection 1',
            },
          },
        },
      ]);
    });

    it('對於無效地址應該拋出錯誤', async () => {
      const invalidAddress = 'invalid-address';

      await expect(provider.getBalances(invalidAddress)).rejects.toThrow(
        'Invalid address: invalid-address',
      );
    });

    it('當獲取餘額失敗時應該拋出錯誤', async () => {
      mainnetClientMock.core.getBalance.mockRejectedValue(new Error('API error'));

      await expect(provider.getBalances(address)).rejects.toThrow(
        'Alchemy provider error: API error',
      );
    });

    it('應該使用測試網客戶端獲取測試網餘額', async () => {
      const result = await provider.getBalances(address, NetworkType.TESTNET);

      // 檢查結果是否包含在測試網時應有的數據
      expect(result.nativeBalance.balance).toBe('1000000000000000000');

      // 在測試網客戶端上檢查方法調用
      expect(testnetClientMock.core.getBalance).toHaveBeenCalledWith(address);
      expect(testnetClientMock.core.getTokenBalances).toHaveBeenCalledWith(address, {
        type: TokenBalanceType.ERC20,
      });
      expect(testnetClientMock.nft.getNftsForOwner).toHaveBeenCalledWith(address);

      // 這裡我們不能直接測試是否使用測試網客戶端，因為這是內部實現
      // 但我們可以檢查是否通過設置正確的網絡模式來初始化客戶端
      expect(Alchemy).toHaveBeenCalledWith(
        expect.objectContaining({
          network: Network.ETH_SEPOLIA,
        }),
      );
    });
  });

  describe('getGasPrice', () => {
    beforeEach(() => {
      mainnetClientMock.core.getFeeData.mockResolvedValue({
        gasPrice: '20000000000', // 20 Gwei
        maxFeePerGas: '25000000000', // 25 Gwei
        maxPriorityFeePerGas: '2000000000', // 2 Gwei
      });
    });

    it('應該優先返回 maxFeePerGas (EIP-1559)', async () => {
      const gasPrice = await provider.getGasPrice();

      expect(gasPrice).toBe('25000000000');
      expect(mainnetClientMock.core.getFeeData).toHaveBeenCalled();
    });

    it('當 maxFeePerGas 不存在時，應該返回傳統 gasPrice', async () => {
      mainnetClientMock.core.getFeeData.mockResolvedValue({
        gasPrice: '20000000000',
        maxFeePerGas: null,
      });

      const gasPrice = await provider.getGasPrice();

      expect(gasPrice).toBe('20000000000');
    });

    it('當獲取 gas 價格失敗時應該拋出錯誤', async () => {
      mainnetClientMock.core.getFeeData.mockRejectedValue(new Error('API error'));

      await expect(provider.getGasPrice()).rejects.toThrow('API error');
    });
  });

  describe('estimateGas', () => {
    const txData: EthereumTransactionRequest = {
      from: '0x1234567890123456789012345678901234567890',
      to: '0x0987654321098765432109876543210987654321',
      value: '1000000000000000000', // 1 ETH
    };

    beforeEach(() => {
      mainnetClientMock.core.estimateGas.mockResolvedValue('21000');
    });

    it('應該返回正確的 gas 估算結果', async () => {
      const gasEstimate = await provider.estimateGas(txData);

      expect(gasEstimate).toBe('21000');
      // 檢查是否傳遞了正確的參數
      expect(mainnetClientMock.core.estimateGas).toHaveBeenCalledWith({
        from: txData.from,
        to: txData.to,
        data: txData.data,
        value: txData.value,
      });
    });

    it('當估算 gas 失敗時應該拋出錯誤', async () => {
      mainnetClientMock.core.estimateGas.mockRejectedValue(new Error('Insufficient funds'));

      await expect(provider.estimateGas(txData)).rejects.toThrow('Insufficient funds');
    });
  });

  describe('getErc20Balance', () => {
    const address = '0x1234567890123456789012345678901234567890';
    const contractAddress = '0xTokenContract';

    beforeEach(() => {
      mainnetClientMock.core.getTokenBalances.mockResolvedValue({
        tokenBalances: [
          {
            contractAddress,
            tokenBalance: '1000000000000000000',
          },
        ],
      });
    });

    it('應該返回正確的 ERC20 代幣餘額', async () => {
      const balance = await provider.getErc20Balance(address, contractAddress);

      expect(balance).toBe('1000000000000000000');
      expect(mainnetClientMock.core.getTokenBalances).toHaveBeenCalledWith(address, [
        contractAddress,
      ]);
    });

    it('當 token 餘額為空時應該返回 0', async () => {
      mainnetClientMock.core.getTokenBalances.mockResolvedValue({
        tokenBalances: [],
      });

      const balance = await provider.getErc20Balance(address, contractAddress);

      expect(balance).toBe('0');
    });

    it('當獲取 ERC20 餘額失敗時應該拋出錯誤', async () => {
      mainnetClientMock.core.getTokenBalances.mockRejectedValue(new Error('API error'));

      await expect(provider.getErc20Balance(address, contractAddress)).rejects.toThrow('API error');
    });
  });

  describe('getErc721Tokens', () => {
    const address = '0x1234567890123456789012345678901234567890';
    const nftMocks = [
      {
        contract: { address: '0xNFT1', name: 'NFT Collection 1' },
        tokenId: '1',
        raw: { metadata: { name: 'NFT One' } },
      },
      {
        contract: { address: '0xNFT2', name: 'NFT Collection 2' },
        tokenId: '2',
        raw: { metadata: { name: 'NFT Two' } },
      },
    ];

    beforeEach(() => {
      mainnetClientMock.nft.getNftsForOwner.mockResolvedValue({
        ownedNfts: nftMocks,
      });
    });

    it('應該返回所有 NFTs 列表', async () => {
      const nfts = await provider.getErc721Tokens(address);

      expect(nfts).toEqual(nftMocks);
      // 修改參數檢查，只檢查第一個參數
      expect(mainnetClientMock.nft.getNftsForOwner).toHaveBeenCalledWith(address);
    });

    it('應該根據合約地址過濾 NFTs', async () => {
      const contractAddress = '0xNFT1';
      await provider.getErc721Tokens(address, contractAddress);

      expect(mainnetClientMock.nft.getNftsForOwner).toHaveBeenCalledWith(address, {
        contractAddresses: [contractAddress],
      });
    });

    it('當獲取 NFTs 失敗時應該拋出錯誤', async () => {
      mainnetClientMock.nft.getNftsForOwner.mockRejectedValue(new Error('API error'));

      await expect(provider.getErc721Tokens(address)).rejects.toThrow('API error');
    });
  });
});
