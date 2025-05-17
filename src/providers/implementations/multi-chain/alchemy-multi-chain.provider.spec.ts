import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AlchemyMultiChainProvider } from './alchemy-multi-chain.provider';
import { ChainName } from '../../../chains/constants';
import { NetworkType } from '../../interfaces/blockchain-provider.interface';

describe('AlchemyMultiChainProvider', () => {
  let provider: AlchemyMultiChainProvider;
  let configService: ConfigService;

  // Mock環境變數
  const mockEnvVars = {
    ALCHEMY_API_KEY_ETH_MAINNET: 'test-eth-key',
    ALCHEMY_API_KEY_POLYGON: 'test-polygon-key',
    ALCHEMY_API_KEY_BSC: 'test-bsc-key',
    ALCHEMY_DEFAULT_CHAIN: 'ethereum',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlchemyMultiChainProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => mockEnvVars[key]),
          },
        },
      ],
    }).compile();

    provider = module.get<AlchemyMultiChainProvider>(AlchemyMultiChainProvider);
    configService = module.get<ConfigService>(ConfigService);

    // Mock私有方法
    (provider as any).chainClients = new Map();
    (provider as any).chainClients.set(ChainName.ETHEREUM, {
      core: {
        getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
        getTokenBalances: jest.fn().mockResolvedValue({ tokenBalances: [] }),
        getTokenMetadata: jest.fn().mockResolvedValue(null),
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: '20000000000',
          maxFeePerGas: '30000000000',
          maxPriorityFeePerGas: '10000000000',
        }),
        estimateGas: jest.fn().mockResolvedValue('21000'),
      },
      nft: {
        getNftsForOwner: jest.fn().mockResolvedValue({ ownedNfts: [] }),
      },
    });

    (provider as any).chainClients.set(
      ChainName.POLYGON,
      (provider as any).chainClients.get(ChainName.ETHEREUM),
    );
    (provider as any).chainClients.set(
      ChainName.BSC,
      (provider as any).chainClients.get(ChainName.ETHEREUM),
    );
  });

  it('應該被定義', () => {
    expect(provider).toBeDefined();
  });

  describe('getProviderName', () => {
    it('應該返回 Alchemy', () => {
      expect(provider.getProviderName()).toBe('Alchemy');
    });
  });

  describe('isSupported', () => {
    it('當至少有一個客戶端初始化時應該返回true', () => {
      expect(provider.isSupported()).toBe(true);
    });

    it('當沒有客戶端初始化時應該返回false', () => {
      (provider as any).chainClients = new Map();
      expect(provider.isSupported()).toBe(false);
    });
  });

  describe('getBaseUrl', () => {
    it('應該返回以太坊主網的正確URL', () => {
      const url = provider.getBaseUrl(NetworkType.MAINNET.toString(), ChainName.ETHEREUM);
      expect(url).toContain('eth-mainnet');
    });

    it('應該根據提供的鏈名稱構建URL', () => {
      const url = provider.getBaseUrl(NetworkType.MAINNET.toString(), ChainName.POLYGON);
      expect(url).toContain('polygon');
    });
  });

  describe('getApiKey', () => {
    it('應該返回指定鏈的API密鑰', () => {
      expect(provider.getApiKey(NetworkType.MAINNET.toString(), ChainName.ETHEREUM)).toBe(
        'test-eth-key',
      );
    });

    it('應該根據鏈回退到正確的環境變量', () => {
      jest.spyOn(configService, 'get').mockImplementation((key) => {
        if (key === 'ALCHEMY_API_KEY_POLYGON_MAINNET') return null;
        if (key === 'ALCHEMY_API_KEY_POLYGON') return 'fallback-polygon-key';
        return null;
      });

      const key = provider.getApiKey(NetworkType.MAINNET.toString(), ChainName.POLYGON);
      expect(key).toBe('fallback-polygon-key');
    });
  });

  describe('getBalances', () => {
    it('當地址無效時應該拋出錯誤', async () => {
      await expect(provider.getBalances('invalid-address')).rejects.toThrow('Invalid address');
    });

    it('應該返回有效的餘額響應', async () => {
      jest.spyOn(provider as any, 'validateEvmAddress').mockReturnValue(true);

      const balances = await provider.getBalances('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');

      expect(balances).toHaveProperty('nativeBalance');
      expect(balances.nativeBalance.balance).toBe('1000000000000000000');
      expect(balances).toHaveProperty('tokens');
      expect(balances).toHaveProperty('nfts');
    });
  });

  describe('多鏈支援', () => {
    it('應該支援所有配置的鏈', () => {
      const supportedChains = (provider as any).supportedChains;
      expect(supportedChains).toContain(ChainName.ETHEREUM);
      expect(supportedChains).toContain(ChainName.POLYGON);
      expect(supportedChains).toContain(ChainName.BSC);
    });

    it('應該為每個不同的鏈使用相應的客戶端', async () => {
      jest.spyOn(provider as any, 'validateEvmAddress').mockReturnValue(true);
      jest.spyOn(provider as any, 'getClient');

      await provider.getBalances(
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        NetworkType.MAINNET,
        ChainName.ETHEREUM,
      );
      expect((provider as any).getClient).toHaveBeenCalledWith(
        NetworkType.MAINNET,
        ChainName.ETHEREUM,
      );

      await provider.getBalances(
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        NetworkType.MAINNET,
        ChainName.POLYGON,
      );
      expect((provider as any).getClient).toHaveBeenCalledWith(
        NetworkType.MAINNET,
        ChainName.POLYGON,
      );
    });
  });
});
