import { Test, TestingModule } from '@nestjs/testing';
import { ProviderFactory } from '../provider.factory';
import { ConfigService } from '@nestjs/config';
import { ChainName } from '../../chains/constants';
import { PROVIDER_METADATA } from '../constants/provider-metadata';
import { PROVIDERS_TOKEN } from '../constants/provider-registration';
import { AlchemyProviderFacade } from '../implementations/multi-chain/alchemy-provider.facade';
import { EthereumQuickNodeProvider } from '../implementations/ethereum/ethereum-quicknode.provider';
import { ModuleRef } from '@nestjs/core';
import { ProviderDiscoveryService } from '../provider-discovery.service';
import {
  BalancesResponse,
  BlockchainProviderInterface,
  ChainConfig,
  NetworkType,
} from '../interfaces/blockchain-provider.interface';
import { ProviderType } from '../constants/blockchain-types';

// Mock provider implementations
class MockProvider implements BlockchainProviderInterface {
  getProviderName() {
    return 'Mock Provider';
  }

  isSupported() {
    return true;
  }

  getBaseUrl() {
    return 'https://mock-provider.io';
  }

  getApiKey() {
    return 'mock-api-key';
  }

  getSupportedChains() {
    return [ChainName.ETHEREUM];
  }

  getChainConfig() {
    return {
      chainId: 1,
      name: 'Ethereum',
      nativeSymbol: 'ETH',
      nativeDecimals: 18,
    };
  }

  async getBalances(address: string, network: NetworkType, chain: ChainName) {
    return {
      nativeBalance: { balance: '1000000000000000000' },
      tokens: [],
      nfts: [],
    };
  }

  async getNFTs(address: string, network: NetworkType, chain: ChainName) {
    return {
      nfts: [],
    };
  }
}

// 從原本 provider.factory.spec.ts 中的模擬以太坊提供者
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
  let mockConfigService: Partial<ConfigService>;
  let mockModuleRef: Partial<ModuleRef>;
  let mockAlchemyFacade: Partial<AlchemyProviderFacade>;
  let mockQuicknodeProvider: Partial<EthereumQuickNodeProvider>;
  let mockDiscoveryService: Partial<ProviderDiscoveryService>;
  // 用於完整測試的 mock 實例
  const mockEthereumProvider = new MockEthereumProvider();

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'blockchain.providers.ethereum') return ['alchemy', 'quicknode'];
        if (key === 'blockchain.providers.solana') return ['alchemy'];
        if (key === 'PROVIDER_ETHEREUM') return 'alchemy';
        return null;
      }),
    };

    mockAlchemyFacade = {
      getProviderName: jest.fn().mockReturnValue('Alchemy'),
      isSupported: jest.fn().mockReturnValue(true),
      getBaseUrl: jest.fn().mockReturnValue('https://eth-mainnet.alchemyapi.io'),
      getApiKey: jest.fn().mockReturnValue('test-api-key'),
    };

    mockQuicknodeProvider = {
      getProviderName: jest.fn().mockReturnValue('QuickNode'),
      isSupported: jest.fn().mockReturnValue(true),
      getBaseUrl: jest.fn().mockReturnValue('https://eth-mainnet.quicknode.io'),
      getApiKey: jest.fn().mockReturnValue('test-api-key'),
    };

    mockModuleRef = {
      get: jest.fn().mockImplementation((token) => {
        if (token === AlchemyProviderFacade) return mockAlchemyFacade;
        if (token === EthereumQuickNodeProvider) return mockQuicknodeProvider;
        if (token === MockEthereumProvider) return mockEthereumProvider;
        return null;
      }),
    };

    mockDiscoveryService = {
      discoverProviders: jest.fn().mockReturnValue([
        {
          blockchainType: ChainName.ETHEREUM,
          providerType: ProviderType.ALCHEMY,
          providerClass: MockProvider,
        },
      ]),
      getRegisteredProviderTypes: jest.fn().mockReturnValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderFactory,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ModuleRef,
          useValue: mockModuleRef,
        },
        {
          provide: ProviderDiscoveryService,
          useValue: mockDiscoveryService,
        },
        {
          provide: PROVIDERS_TOKEN,
          useValue: [],
        },
      ],
    }).compile();

    factory = module.get<ProviderFactory>(ProviderFactory);

    // 手動初始化
    factory.onModuleInit();
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('getProvider', () => {
    it('should return a provider for a given chain and provider ID', () => {
      // 手動設置已註冊的提供者
      (factory as any).providers = new Map();
      (factory as any).providers.set(
        ChainName.ETHEREUM,
        new Map([[PROVIDER_METADATA, MockProvider]]),
      );

      // 模擬 moduleRef.get 返回 mockAlchemyFacade
      jest.spyOn(mockModuleRef, 'get').mockReturnValue(mockAlchemyFacade);

      const provider = factory.getProvider(ChainName.ETHEREUM, PROVIDER_METADATA);
      expect(provider).toBeDefined();
    });

    it('should throw error if chain is not supported', () => {
      expect(() =>
        factory.getProvider('UNSUPPORTED_CHAIN' as ChainName, PROVIDER_METADATA),
      ).toThrow();
    });

    it('should throw error if provider is not available for chain', () => {
      // 設置空映射
      (factory as any).providers = new Map();
      (factory as any).providers.set(ChainName.ETHEREUM, new Map());

      expect(() => factory.getProvider(ChainName.ETHEREUM, 'INVALID_PROVIDER')).toThrow();
    });

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
  });

  describe('getProvider with default provider type', () => {
    it('should return primary provider for a chain', () => {
      // 手動設置已註冊的提供者
      (factory as any).providers = new Map();
      (factory as any).providers.set(
        ChainName.ETHEREUM,
        new Map([[PROVIDER_METADATA, MockProvider]]),
      );

      // 模擬 getDefaultProviderType 方法返回 PROVIDER_METADATA
      jest.spyOn(factory as any, 'getDefaultProviderType').mockReturnValue(PROVIDER_METADATA);

      // 模擬 moduleRef.get 返回 mockAlchemyFacade
      jest.spyOn(mockModuleRef, 'get').mockReturnValue(mockAlchemyFacade);

      const provider = factory.getProvider(ChainName.ETHEREUM);
      expect(provider).toBeDefined();
    });

    it('should throw error if no primary provider exists for chain', () => {
      (factory as any).providers = new Map();
      expect(() => factory.getProvider('UNSUPPORTED_CHAIN' as ChainName)).toThrow();
    });
  });

  describe('getProvider for multiple providers', () => {
    it('should return all providers for a chain', () => {
      // 手動設置已註冊的提供者
      const providerClassesMap = new Map([
        [PROVIDER_METADATA, MockProvider],
        ['quicknode', MockProvider],
      ]);
      (factory as any).providers = new Map();
      (factory as any).providers.set(ChainName.ETHEREUM, providerClassesMap);

      // 模擬 moduleRef.get 分別返回兩個不同的提供者
      jest
        .spyOn(mockModuleRef, 'get')
        .mockImplementationOnce(() => mockAlchemyFacade)
        .mockImplementationOnce(() => mockQuicknodeProvider);

      const provider1 = factory.getProvider(ChainName.ETHEREUM, PROVIDER_METADATA);
      const provider2 = factory.getProvider(ChainName.ETHEREUM, 'quicknode');

      expect(provider1).toBeDefined();
      expect(provider2).toBeDefined();
    });
  });

  describe('registerProviders', () => {
    it('should register providers from manually passed array', () => {
      const newFactory = new ProviderFactory(
        mockModuleRef as ModuleRef,
        mockConfigService as ConfigService,
        mockDiscoveryService as ProviderDiscoveryService,
        [
          {
            blockchainType: ChainName.SOLANA,
            providerType: ProviderType.ALCHEMY,
            providerClass: MockEthereumProvider, // 為了測試目的重用
          },
        ],
      );

      expect((newFactory as any).providers.has(ChainName.SOLANA)).toBeTruthy();
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

  describe('onModuleInit', () => {
    it('should initialize providers', () => {
      // 測試 onModuleInit 方法
      // 模擬 discoveryService.discoverProviders 返回一些供應商
      jest.spyOn(mockDiscoveryService, 'discoverProviders').mockReturnValue([
        {
          blockchainType: ChainName.ETHEREUM,
          providerType: PROVIDER_METADATA,
          providerClass: MockProvider,
        },
      ]);

      // 呼叫 onModuleInit
      factory.onModuleInit();

      // 驗證 discoveryService.discoverProviders 被調用
      expect(mockDiscoveryService.discoverProviders).toHaveBeenCalled();
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

      expect(providers.length).toBeGreaterThan(0);
      expect(providers[0].blockchainType).toBe(ChainName.ETHEREUM);
    });
  });
});
