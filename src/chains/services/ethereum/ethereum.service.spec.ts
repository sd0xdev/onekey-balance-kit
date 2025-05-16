import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EthereumService } from './ethereum.service';
import { ProviderFactory } from '../../../providers/provider.factory';
import { EthereumChainId, ETH_SYMBOL, ETH_DECIMALS } from './constants';
import { ChainName } from '../../constants';
import { NetworkType } from '../../../providers/interfaces/blockchain-provider.interface';

// 模擬以太坊提供者
const mockEthereumProvider = {
  getProviderName: jest.fn().mockReturnValue('MockProvider'),
  isSupported: jest.fn().mockReturnValue(true),
  getBalances: jest.fn(),
};

// 模擬提供者工廠
const mockProviderFactory = {
  getEthereumProvider: jest.fn().mockReturnValue(mockEthereumProvider),
  getEvmProvider: jest.fn().mockReturnValue(mockEthereumProvider),
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

describe('EthereumService', () => {
  let service: EthereumService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EthereumService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ProviderFactory, useValue: mockProviderFactory },
      ],
    }).compile();

    service = module.get<EthereumService>(EthereumService);
    jest.clearAllMocks();
  });

  it('應該被定義', () => {
    expect(service).toBeDefined();
  });

  describe('getChainName', () => {
    it('應該返回以太坊鏈名稱', () => {
      expect(service.getChainName()).toBe('Ethereum');
    });
  });

  describe('getChainSymbol', () => {
    it('應該返回以太坊符號', () => {
      expect(service.getChainSymbol()).toBe(ETH_SYMBOL);
    });
  });

  describe('isValidAddress', () => {
    it('應該驗證有效的以太坊地址', () => {
      const validAddress = '0x1234567890123456789012345678901234567890';
      expect(service.isValidAddress(validAddress)).toBe(true);
    });

    it('應該拒絕無效的以太坊地址', () => {
      const invalidAddress = '0xinvalid';
      expect(service.isValidAddress(invalidAddress)).toBe(false);
    });
  });

  describe('getAddressTransactionHashes', () => {
    it('應該返回地址的交易雜湊列表', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const hashes = await service.getAddressTransactionHashes(address);
      expect(hashes).toEqual(['0xsample1', '0xsample2']);
    });

    it('對於無效地址應該拋出錯誤', async () => {
      const invalidAddress = '0xinvalid';
      await expect(service.getAddressTransactionHashes(invalidAddress)).rejects.toThrow(
        'Invalid Ethereum address',
      );
    });
  });

  describe('getTransactionDetails', () => {
    it('應該返回交易詳情', async () => {
      const hash = '0x1234567890123456789012345678901234567890123456789012345678901234';
      const details = await service.getTransactionDetails(hash);
      expect(details).toEqual({
        hash,
        from: '0xsender',
        to: '0xreceiver',
        value: '1000000000000000000',
      });
    });

    it('對於無效的交易雜湊應該拋出錯誤', async () => {
      const invalidHash = '0xinvalid';
      await expect(service.getTransactionDetails(invalidHash)).rejects.toThrow(
        'Invalid Ethereum transaction hash',
      );
    });
  });

  describe('getBalances', () => {
    const address = '0x1234567890123456789012345678901234567890';
    const mockProviderResponse = {
      nativeBalance: {
        balance: '2000000000000000000', // 2 ETH
      },
      tokens: [
        {
          mint: '0xTokenAddress',
          balance: '1000000000000000000',
          tokenMetadata: {
            symbol: 'TEST',
            decimals: 18,
          },
        },
      ],
      nfts: [
        {
          mint: '0xNFTAddress',
          tokenId: '123',
          tokenMetadata: {
            name: 'Test NFT',
            image: 'https://test.com/image.png',
            collection: {
              name: 'Test Collection',
            },
          },
        },
      ],
    };

    beforeEach(() => {
      mockEthereumProvider.getBalances.mockResolvedValue(mockProviderResponse);
    });

    it('應該使用提供者獲取餘額並返回正確格式的結果', async () => {
      const result = await service.getBalances(address);

      expect(mockProviderFactory.getEvmProvider).toHaveBeenCalledWith(
        EthereumChainId.MAINNET,
        'alchemy',
      );
      expect(mockEthereumProvider.getBalances).toHaveBeenCalledWith(address, NetworkType.MAINNET);

      expect(result).toEqual({
        chainId: EthereumChainId.MAINNET,
        nativeBalance: {
          symbol: ETH_SYMBOL,
          decimals: ETH_DECIMALS,
          balance: '2000000000000000000',
          usd: 0,
        },
        fungibles: [
          {
            mint: '0xTokenAddress',
            symbol: 'TEST',
            decimals: 18,
            balance: '1000000000000000000',
            usd: 0,
          },
        ],
        nfts: [
          {
            mint: '0xNFTAddress',
            tokenId: '123',
            collection: 'Test Collection',
            name: 'Test NFT',
            image: 'https://test.com/image.png',
          },
        ],
        updatedAt: expect.any(Number),
      });
    });

    it('應該使用測試網絡獲取餘額', async () => {
      await service.getBalances(address, EthereumChainId.SEPOLIA);

      expect(mockProviderFactory.getEvmProvider).toHaveBeenCalledWith(
        EthereumChainId.SEPOLIA,
        'alchemy',
      );
      expect(mockEthereumProvider.getBalances).toHaveBeenCalledWith(address, NetworkType.TESTNET);
    });

    it('應該使用指定的提供者類型', async () => {
      const providerType = 'quicknode';
      await service.getBalances(address, EthereumChainId.MAINNET, providerType);

      expect(mockProviderFactory.getEvmProvider).toHaveBeenCalledWith(
        EthereumChainId.MAINNET,
        providerType,
      );
    });

    it('如果地址無效應該拋出錯誤', async () => {
      const invalidAddress = '0xinvalid';
      await expect(service.getBalances(invalidAddress)).rejects.toThrow('Invalid Ethereum address');
    });

    it('如果提供者不支持應該使用默認實現', async () => {
      mockEthereumProvider.isSupported.mockReturnValueOnce(false);

      const result = await service.getBalances(address);

      expect(result).toEqual({
        chainId: EthereumChainId.MAINNET,
        nativeBalance: {
          symbol: ETH_SYMBOL,
          decimals: ETH_DECIMALS,
          balance: '1000000000000000000',
          usd: 0,
        },
        fungibles: [],
        nfts: [],
        updatedAt: expect.any(Number),
      });
    });

    it('如果提供者拋出錯誤應該使用默認實現', async () => {
      mockEthereumProvider.getBalances.mockRejectedValueOnce(new Error('Provider error'));

      const result = await service.getBalances(address);

      expect(result).toEqual({
        chainId: EthereumChainId.MAINNET,
        nativeBalance: {
          symbol: ETH_SYMBOL,
          decimals: ETH_DECIMALS,
          balance: '1000000000000000000',
          usd: 0,
        },
        fungibles: [],
        nfts: [],
        updatedAt: expect.any(Number),
      });
    });
  });
});
