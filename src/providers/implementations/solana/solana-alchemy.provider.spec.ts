import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { of } from 'rxjs';
import { SolanaAlchemyProvider } from './solana-alchemy.provider';
import { NetworkType } from '../../interfaces/blockchain-provider.interface';

// Solana 代幣程式 ID 常量 - 與實際實現中一致的值
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// 模擬 @solana/web3.js 的 Connection 類
jest.mock('@solana/web3.js', () => {
  const originalModule = jest.requireActual('@solana/web3.js');

  // 創建模擬 Connection 工廠
  const createMockConnection = () => ({
    getBalance: jest.fn().mockResolvedValue(1000000000), // 1 SOL
    getParsedTokenAccountsByOwner: jest.fn().mockResolvedValue({
      value: [
        {
          account: {
            data: {
              parsed: {
                info: {
                  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                  tokenAmount: {
                    amount: '100000000',
                    decimals: 9,
                  },
                },
              },
            },
          },
        },
        {
          account: {
            data: {
              parsed: {
                info: {
                  mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
                  tokenAmount: {
                    amount: '200000000',
                    decimals: 9,
                  },
                },
              },
            },
          },
        },
      ],
    }),
    getLatestBlockhash: jest.fn().mockResolvedValue({ blockhash: 'mocked-blockhash' }),
    getAccountInfo: jest.fn().mockResolvedValue({ data: Buffer.from('mock-data') }),
  });

  // 創建兩個模擬連接，一個用於主網，一個用於開發網
  const mockMainnetConnection = createMockConnection();
  const mockDevnetConnection = createMockConnection();

  let connectionCallCount = 0;

  return {
    ...originalModule,
    Connection: jest.fn().mockImplementation(() => {
      connectionCallCount++;
      return connectionCallCount === 1 ? mockMainnetConnection : mockDevnetConnection;
    }),
    clusterApiUrl: jest.fn().mockReturnValue('https://api.devnet.solana.com'),
  };
});

// 模擬 ConfigService
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
    const config: { [key: string]: string } = {
      ALCHEMY_API_KEY_SOL_MAINNET: 'test-sol-mainnet-api-key',
      ALCHEMY_API_KEY_SOL_TESTNET: 'test-sol-testnet-api-key',
    };
    return config[key] || defaultValue;
  }),
};

// 模擬 HttpService
const mockHttpService = {
  post: jest.fn(),
};

describe('SolanaAlchemyProvider', () => {
  let provider: SolanaAlchemyProvider;
  let mainnetConnectionMock: any;
  let devnetConnectionMock: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // 設置 HTTP 模擬回應
    mockHttpService.post.mockImplementation(() =>
      of({
        data: {
          result: [
            {
              mint: 'NftMintAddress1',
              tokenId: '1',
              name: 'Test NFT',
              image: 'https://example.com/nft1.png',
              collection: {
                name: 'Test Collection',
              },
            },
          ],
        },
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolanaAlchemyProvider,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    provider = module.get<SolanaAlchemyProvider>(SolanaAlchemyProvider);

    // 獲取 Connection 構造函數的模擬實例
    mainnetConnectionMock = (Connection as jest.Mock).mock.results[0].value;
    devnetConnectionMock = (Connection as jest.Mock).mock.results[1].value;
  });

  it('應該被定義', () => {
    expect(provider).toBeDefined();
  });

  describe('初始化', () => {
    it('應該使用正確的配置初始化 Solana 主網連接', () => {
      expect(Connection).toHaveBeenCalledWith(
        'https://solana-mainnet.g.alchemy.com/v2/test-sol-mainnet-api-key',
        'confirmed',
      );
    });

    it('應該使用正確的配置初始化 Solana 開發網連接', () => {
      expect(Connection).toHaveBeenCalledWith(
        'https://solana-devnet.g.alchemy.com/v2/test-sol-testnet-api-key',
        'confirmed',
      );
    });
  });

  describe('getProviderName', () => {
    it('應該返回正確的提供者名稱', () => {
      expect(provider.getProviderName()).toBe('Alchemy');
    });
  });

  describe('isSupported', () => {
    it('當 Solana 主網連接存在時，應該返回 true', () => {
      expect(provider.isSupported()).toBe(true);
    });
  });

  describe('getBaseUrl', () => {
    it('應該返回正確的主網基礎 URL', () => {
      expect(provider.getBaseUrl(NetworkType.MAINNET.toString())).toBe(
        'https://solana-mainnet.g.alchemy.com/v2/',
      );
    });

    it('應該返回正確的開發網基礎 URL', () => {
      expect(provider.getBaseUrl(NetworkType.TESTNET.toString())).toBe(
        'https://solana-devnet.g.alchemy.com/v2/',
      );
    });
  });

  describe('getApiKey', () => {
    it('應該返回正確的主網 API 密鑰', () => {
      expect(provider.getApiKey(NetworkType.MAINNET.toString())).toBe('test-sol-mainnet-api-key');
    });

    it('應該返回正確的開發網 API 密鑰', () => {
      expect(provider.getApiKey(NetworkType.TESTNET.toString())).toBe('test-sol-testnet-api-key');
    });
  });

  describe('getBalances', () => {
    const address = 'BVr9LTDQ8R54ZXPQRYnJuZBYYhXGP8dWveo4HrQRMj9Q'; // 有效的 Solana 地址

    it('應該返回正確格式的餘額資訊', async () => {
      const result = await provider.getBalances(address);

      expect(mainnetConnectionMock.getBalance).toHaveBeenCalledWith(expect.any(PublicKey));
      expect(mainnetConnectionMock.getParsedTokenAccountsByOwner).toHaveBeenCalledWith(
        expect.any(PublicKey),
        {
          programId: TOKEN_PROGRAM_ID,
        },
      );

      expect(result).toEqual({
        nativeBalance: {
          balance: '1000000000',
        },
        tokens: [
          {
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
            tokenMetadata: {
              symbol: 'Unknown',
              decimals: 9,
            },
            balance: '100000000',
          },
          {
            mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
            tokenMetadata: {
              symbol: 'Unknown',
              decimals: 9,
            },
            balance: '200000000',
          },
        ],
        nfts: expect.any(Array),
        isSuccess: true,
      });
    });

    it('對於無效地址應該拋出錯誤', async () => {
      const invalidAddress = 'invalid-address';
      await expect(provider.getBalances(invalidAddress)).rejects.toThrow('Invalid Solana address');
    });

    it('當獲取餘額失敗時應該拋出錯誤', async () => {
      mainnetConnectionMock.getBalance.mockRejectedValueOnce(new Error('Connection error'));
      await expect(provider.getBalances(address)).rejects.toThrow(
        'Alchemy provider error: Connection error',
      );
    });

    it('應該使用開發網連接獲取測試網餘額', async () => {
      await provider.getBalances(address, NetworkType.TESTNET);
      expect(devnetConnectionMock.getBalance).toHaveBeenCalledWith(expect.any(PublicKey));
    });
  });

  describe('getRecentBlockhash', () => {
    it('應該返回區塊哈希', async () => {
      const blockhash = await provider.getRecentBlockhash();
      expect(blockhash).toBe('mocked-blockhash');
      expect(mainnetConnectionMock.getLatestBlockhash).toHaveBeenCalled();
    });

    it('當獲取區塊哈希失敗時應該拋出錯誤', async () => {
      mainnetConnectionMock.getLatestBlockhash.mockRejectedValueOnce(new Error('Blockhash error'));
      await expect(provider.getRecentBlockhash()).rejects.toThrow('Blockhash error');
    });
  });

  describe('getSplTokenBalance', () => {
    const address = 'BVr9LTDQ8R54ZXPQRYnJuZBYYhXGP8dWveo4HrQRMj9Q';
    const mintAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC 代幣的有效 Solana 地址

    beforeEach(() => {
      mainnetConnectionMock.getParsedTokenAccountsByOwner.mockResolvedValue({
        value: [
          {
            account: {
              data: {
                parsed: {
                  info: {
                    tokenAmount: {
                      amount: '100000000',
                    },
                  },
                },
              },
            },
          },
        ],
      });
    });

    it('應該返回正確的 SPL 代幣餘額', async () => {
      const balance = await provider.getSplTokenBalance(address, mintAddress);
      expect(balance).toBe('100000000');
      expect(mainnetConnectionMock.getParsedTokenAccountsByOwner).toHaveBeenCalledWith(
        expect.any(PublicKey),
        {
          mint: expect.any(PublicKey),
        },
      );
    });

    it('當未找到代幣帳戶時應該返回 0', async () => {
      mainnetConnectionMock.getParsedTokenAccountsByOwner.mockResolvedValue({ value: [] });
      const balance = await provider.getSplTokenBalance(address, mintAddress);
      expect(balance).toBe('0');
    });

    it('當獲取代幣餘額失敗時應該拋出錯誤', async () => {
      mainnetConnectionMock.getParsedTokenAccountsByOwner.mockRejectedValueOnce(
        new Error('Token error'),
      );
      await expect(provider.getSplTokenBalance(address, mintAddress)).rejects.toThrow(
        'Token error',
      );
    });
  });

  describe('getNfts', () => {
    const address = 'BVr9LTDQ8R54ZXPQRYnJuZBYYhXGP8dWveo4HrQRMj9Q';
    const collection = '3saAedkM9o5g1u5DCqsuMZuC4GRqPB4TuMkvSsSVvGQ3'; // 有效的 Solana 集合地址

    beforeEach(() => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            result: [
              {
                mint: 'A7p8451ktDCHq5yYaHczeLMYsjRsAkzc3hCXcSrwYHU7', // 有效的 NFT mint 地址
                name: 'Test NFT',
              },
            ],
          },
        }),
      );
    });

    it('應該返回 NFT 列表', async () => {
      const nfts = await provider.getNfts(address);
      expect(nfts).toEqual([
        {
          mint: 'A7p8451ktDCHq5yYaHczeLMYsjRsAkzc3hCXcSrwYHU7',
          name: 'Test NFT',
        },
      ]);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('https://solana-mainnet.g.alchemy.com/v2/'),
        expect.objectContaining({
          method: 'alchemy_getNfts',
          params: [address],
        }),
      );
    });

    it('應該在請求中包含集合參數', async () => {
      await provider.getNfts(address, collection);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: [address, { collection }],
        }),
      );
    });

    it('當 HTTP 請求失敗時應該拋出錯誤', async () => {
      mockHttpService.post.mockImplementationOnce(() => {
        throw new Error('HTTP error');
      });
      await expect(provider.getNfts(address)).rejects.toThrow('HTTP error');
    });
  });

  describe('getAccountInfo', () => {
    const address = 'BVr9LTDQ8R54ZXPQRYnJuZBYYhXGP8dWveo4HrQRMj9Q';

    it('應該返回帳戶資訊', async () => {
      const accountInfo = await provider.getAccountInfo(address);
      expect(accountInfo).toEqual({ data: expect.any(Buffer) });
      expect(mainnetConnectionMock.getAccountInfo).toHaveBeenCalledWith(expect.any(PublicKey));
    });

    it('當獲取帳戶資訊失敗時應該拋出錯誤', async () => {
      mainnetConnectionMock.getAccountInfo.mockRejectedValueOnce(new Error('Account error'));
      await expect(provider.getAccountInfo(address)).rejects.toThrow('Account error');
    });
  });
});
