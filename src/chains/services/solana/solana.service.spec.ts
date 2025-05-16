import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SolanaService, SolanaBalancesResponse } from './solana.service';
import { ProviderFactory } from '../../../providers/provider.factory';
import { SolanaCluster, SOL_SYMBOL, SOL_DECIMALS } from './constants';
import { ChainName } from '../../constants';
import { NetworkType } from '../../../providers/interfaces/blockchain-provider.interface';

// 模擬 Solana 提供者
const mockSolanaProvider = {
  getProviderName: jest.fn().mockReturnValue('MockSolanaProvider'),
  isSupported: jest.fn().mockReturnValue(true),
  getBalances: jest.fn(),
};

// 模擬提供者工廠
const mockProviderFactory = {
  getProvider: jest.fn().mockReturnValue(mockSolanaProvider),
};

// 模擬配置服務
const mockConfigService = {
  get: jest.fn().mockImplementation((key, defaultValue) => {
    if (key === 'blockchain.defaultProvider') {
      return 'alchemy';
    }
    return defaultValue;
  }),
};

describe('SolanaService', () => {
  let service: SolanaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolanaService,
        { provide: ProviderFactory, useValue: mockProviderFactory },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SolanaService>(SolanaService);
    jest.clearAllMocks();
  });

  it('應該被定義', () => {
    expect(service).toBeDefined();
  });

  describe('getChainName', () => {
    it('應該返回 Solana 鏈名稱', () => {
      expect(service.getChainName()).toBe(ChainName.SOLANA);
    });
  });

  describe('getChainSymbol', () => {
    it('應該返回 Solana 符號', () => {
      expect(service.getChainSymbol()).toBe(SOL_SYMBOL);
    });
  });

  describe('isValidAddress', () => {
    it('應該驗證有效的 Solana 地址', () => {
      // Solana 有效地址是一個 base58 編碼的 32 字節公鑰
      const validAddress = '5vxoRv2P12q2YwUWQHQj9pEQRAEXjz8VQFtdoqAR7j4X';
      expect(service.isValidAddress(validAddress)).toBe(true);
    });

    it('應該拒絕無效的 Solana 地址', () => {
      const invalidAddress = 'invalid-address';
      expect(service.isValidAddress(invalidAddress)).toBe(false);
    });
  });

  describe('getAddressTransactionHashes', () => {
    it('應該返回地址的交易雜湊列表', async () => {
      const address = '5vxoRv2P12q2YwUWQHQj9pEQRAEXjz8VQFtdoqAR7j4X';
      const hashes = await service.getAddressTransactionHashes(address);
      expect(hashes).toEqual(['sample_hash_1', 'sample_hash_2']);
    });
  });

  describe('getTransactionDetails', () => {
    it('應該返回交易詳情', async () => {
      const hash = 'transaction_hash_123';
      const details = await service.getTransactionDetails(hash);
      expect(details).toHaveProperty('hash', hash);
      expect(details).toHaveProperty('slot');
      expect(details).toHaveProperty('blockTime');
      expect(details).toHaveProperty('fee');
    });
  });

  describe('getBalances', () => {
    const address = '5vxoRv2P12q2YwUWQHQj9pEQRAEXjz8VQFtdoqAR7j4X';
    const mockProviderResponse = {
      isSuccess: true,
      nativeBalance: {
        balance: '5000000000', // 5 SOL
      },
      tokens: [
        {
          mint: 'TokenMintAddress1',
          balance: '100000000',
          tokenMetadata: {
            symbol: 'TEST',
            decimals: 9,
            name: 'Test Token',
          },
        },
      ],
      nfts: [
        {
          mint: 'NftMintAddress1',
          tokenId: '1',
          tokenMetadata: {
            name: 'Test NFT',
            image: 'https://test.com/nft.png',
            collection: {
              name: 'Test Collection',
            },
          },
        },
      ],
    };

    beforeEach(() => {
      mockSolanaProvider.getBalances.mockResolvedValue(mockProviderResponse);
    });

    it('應該使用提供者獲取餘額並返回正確格式的結果', async () => {
      const result = await service.getBalances(address);

      expect(mockProviderFactory.getProvider).toHaveBeenCalledWith(ChainName.SOLANA, 'alchemy');
      expect(mockSolanaProvider.getBalances).toHaveBeenCalledWith(address, NetworkType.MAINNET);

      expect(result).toEqual({
        cluster: SolanaCluster.MAINNET,
        nativeBalance: {
          symbol: SOL_SYMBOL,
          decimals: SOL_DECIMALS,
          balance: '5000000000',
          usd: 0,
        },
        tokens: [
          {
            mint: 'TokenMintAddress1',
            balance: '100000000',
            tokenMetadata: {
              symbol: 'TEST',
              decimals: 9,
              name: 'Test Token',
            },
          },
        ],
        nfts: [
          {
            mint: 'NftMintAddress1',
            tokenId: '1',
            tokenMetadata: {
              name: 'Test NFT',
              image: 'https://test.com/nft.png',
              collection: {
                name: 'Test Collection',
              },
            },
          },
        ],
        updatedAt: expect.any(Number),
      });
    });

    it('應該使用測試網絡獲取餘額', async () => {
      await service.getBalances(address, SolanaCluster.TESTNET as unknown as number);

      expect(mockSolanaProvider.getBalances).toHaveBeenCalledWith(address, NetworkType.TESTNET);

      // 檢查結果包含正確的集群
      const result = await service.getBalances(address, SolanaCluster.TESTNET as unknown as number);
      expect(result.cluster).toBe(SolanaCluster.TESTNET);
    });

    it('應該使用指定的提供者類型', async () => {
      const providerType = 'quicknode';
      await service.getBalances(address, SolanaCluster.MAINNET as unknown as number, providerType);

      expect(mockProviderFactory.getProvider).toHaveBeenCalledWith(ChainName.SOLANA, providerType);
    });

    it('如果地址無效應該返回零餘額的響應', async () => {
      const invalidAddress = 'invalid-address';
      const result = await service.getBalances(invalidAddress);

      expect(result).toEqual({
        cluster: SolanaCluster.MAINNET,
        nativeBalance: {
          symbol: SOL_SYMBOL,
          decimals: SOL_DECIMALS,
          balance: '0',
          usd: 0,
        },
        tokens: [],
        nfts: [],
        updatedAt: expect.any(Number),
      });
    });

    it('如果提供者不支持應該使用默認實現', async () => {
      mockSolanaProvider.isSupported.mockReturnValueOnce(false);

      const result = await service.getBalances(address);

      expect(result).toEqual({
        cluster: SolanaCluster.MAINNET,
        nativeBalance: {
          symbol: SOL_SYMBOL,
          decimals: SOL_DECIMALS,
          balance: '1000000000',
          usd: 100,
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
        updatedAt: expect.any(Number),
      });
    });

    it('如果提供者拋出錯誤應該使用默認實現', async () => {
      mockSolanaProvider.getBalances.mockRejectedValueOnce(new Error('Provider error'));

      const result = await service.getBalances(address);

      expect(result.nativeBalance.balance).toBe('1000000000'); // 默認實現
    });

    it('如果提供者返回失敗狀態應該使用默認實現', async () => {
      mockSolanaProvider.getBalances.mockResolvedValueOnce({
        isSuccess: false,
        errorMessage: 'Provider error',
        nativeBalance: { balance: '0' },
        tokens: [],
        nfts: [],
      });

      const result = await service.getBalances(address);

      expect(result.nativeBalance.balance).toBe('1000000000'); // 默認實現
    });
  });
});
