import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ProviderFactory } from './provider.factory';
import { ProviderDiscoveryService } from './provider-discovery.service';
import { PROVIDERS_TOKEN } from './constants/provider-registration';
import { ChainName } from '../chains/constants';
import {
  BalancesResponse,
  ChainConfig,
  NetworkType,
} from './interfaces/blockchain-provider.interface';
import { ProviderType } from './constants/blockchain-types';

// 創建模擬區塊鏈提供者
class MockEthereumProvider {
  getProviderName(): string {
    return 'MockEthereum';
  }

  getBlockchainType(): ChainName {
    return ChainName.ETHEREUM;
  }

  getSupportedNetworks(): NetworkType[] {
    return [NetworkType.MAINNET, NetworkType.TESTNET];
  }

  async getBalance(address: string, network?: NetworkType): Promise<any> {
    return { balance: '1000000000000000000' };
  }

  getChainConfig(): ChainConfig {
    return {
      chainId: 1,
      name: 'Ethereum Mainnet',
      nativeSymbol: 'ETH',
      nativeDecimals: 18,
      testnetChainId: 5,
      testnetName: 'Goerli',
    };
  }

  getBalances(address: string, networkType?: NetworkType): Promise<BalancesResponse> {
    return Promise.resolve({
      nativeBalance: {
        balance: '1000000000000000000',
      },
      tokens: [],
      nfts: [],
    });
  }

  isSupported(): boolean {
    return true;
  }

  getApiKey(): string {
    return 'test-api-key';
  }

  getBaseUrl(): string {
    return 'https://test.url';
  }
}

describe('ProviderFactory', () => {
  let factory: ProviderFactory;
  let configService: ConfigService;
  let discoveryService: ProviderDiscoveryService;
  let moduleRef: ModuleRef;

  // 模擬提供者
  const mockEthereumProvider = new MockEthereumProvider();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderFactory,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key, defaultValue) => {
              if (key === 'PROVIDER_ETHEREUM') return 'alchemy';
              return defaultValue;
            }),
          },
        },
        {
          provide: ProviderDiscoveryService,
          useValue: {
            discoverProviders: jest.fn().mockReturnValue([
              {
                blockchainType: ChainName.ETHEREUM,
                providerType: ProviderType.ALCHEMY,
                providerClass: MockEthereumProvider,
              },
            ]),
          },
        },
        {
          provide: ModuleRef,
          useValue: {
            get: jest.fn().mockImplementation((type) => {
              if (type === MockEthereumProvider) {
                return mockEthereumProvider;
              }
              throw new Error(`Unexpected provider type: ${type.name}`);
            }),
          },
        },
        {
          provide: PROVIDERS_TOKEN,
          useValue: [],
        },
      ],
    }).compile();

    factory = module.get<ProviderFactory>(ProviderFactory);
    configService = module.get<ConfigService>(ConfigService);
    discoveryService = module.get<ProviderDiscoveryService>(ProviderDiscoveryService);
    moduleRef = module.get<ModuleRef>(ModuleRef);

    // 手動初始化
    await (factory as any).onModuleInit();
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('registerProviders', () => {
    it('should register providers from manually passed array', () => {
      const newFactory = new ProviderFactory(moduleRef, configService, discoveryService, [
        {
          blockchainType: ChainName.SOLANA,
          providerType: ProviderType.ALCHEMY,
          providerClass: MockEthereumProvider, // 為了測試目的重用
        },
      ]);

      expect((newFactory as any).providers.has(ChainName.SOLANA)).toBeTruthy();
    });
  });

  describe('getProvider', () => {
    it('should return a provider for a valid blockchain type and provider type', async () => {
      jest.spyOn(factory as any, 'getProviderClass').mockReturnValue(MockEthereumProvider);

      const provider = factory.getProvider(ChainName.ETHEREUM, ProviderType.ALCHEMY);

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('MockEthereum');
    });

    it('should cache and return the same provider instance for the same parameters', async () => {
      jest.spyOn(factory as any, 'getProviderClass').mockReturnValue(MockEthereumProvider);

      const provider1 = factory.getProvider(ChainName.ETHEREUM, ProviderType.ALCHEMY);
      const provider2 = factory.getProvider(ChainName.ETHEREUM, ProviderType.ALCHEMY);

      expect(provider1).toBe(provider2);
    });

    it('should throw an error for invalid blockchain type', async () => {
      jest.spyOn(factory as any, 'getProviderClass').mockReturnValue(undefined);

      expect(() => factory.getProvider('invalid' as ChainName, ProviderType.ALCHEMY)).toThrow();
    });
  });

  describe('getEthereumProvider', () => {
    it('should return an Ethereum provider', () => {
      jest.spyOn(factory, 'getProvider').mockReturnValue(mockEthereumProvider);

      const provider = factory.getEthereumProvider(ProviderType.ALCHEMY);

      expect(provider).toBeDefined();
      expect((factory.getProvider as any).mock.calls[0]).toEqual([
        ChainName.ETHEREUM,
        ProviderType.ALCHEMY,
      ]);
    });
  });

  describe('getSolanaProvider', () => {
    it('should return a Solana provider', () => {
      jest.spyOn(factory, 'getProvider').mockReturnValue(mockEthereumProvider);

      const provider = factory.getSolanaProvider(ProviderType.ALCHEMY);

      expect(provider).toBeDefined();
      expect((factory.getProvider as any).mock.calls[0]).toEqual([
        ChainName.SOLANA,
        ProviderType.ALCHEMY,
      ]);
    });
  });

  describe('getEvmProvider', () => {
    it('should return an EVM provider for a valid chain ID', () => {
      jest.spyOn(factory as any, 'getChainTypeFromChainId').mockReturnValue(ChainName.ETHEREUM);
      jest.spyOn(factory, 'getProvider').mockReturnValue(mockEthereumProvider);

      const provider = factory.getEvmProvider(1);

      expect(provider).toBeDefined();
      expect((factory.getProvider as any).mock.calls[0]).toEqual([ChainName.ETHEREUM, undefined]);
    });

    it('should throw an error for an invalid chain ID', () => {
      jest.spyOn(factory as any, 'getChainTypeFromChainId').mockReturnValue(null);

      expect(() => factory.getEvmProvider(99999)).toThrow();
    });
  });

  describe('listProviders', () => {
    it('should list all registered providers', () => {
      // 模擬內部 providers 映射
      (factory as any).providers = new Map([
        [
          ChainName.ETHEREUM,
          new Map([
            [ProviderType.ALCHEMY, MockEthereumProvider],
            [ProviderType.INFURA, MockEthereumProvider],
          ]),
        ],
      ]);

      const providers = factory.listProviders();

      expect(providers).toHaveLength(2);
      expect(providers[0].blockchainType).toBe(ChainName.ETHEREUM);
      expect(providers[0].providerType).toBe(ProviderType.ALCHEMY);
    });
  });
});
