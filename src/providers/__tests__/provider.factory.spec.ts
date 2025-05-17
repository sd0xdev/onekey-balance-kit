import { Test, TestingModule } from '@nestjs/testing';
import { ProviderFactory } from '../provider.factory';
import { ConfigService } from '@nestjs/config';
import { ChainName } from '../../chains/constants';
import { PROVIDER_METADATA } from '../constants/provider-metadata';
import { AlchemyProviderFacade } from '../implementations/multi-chain/alchemy-provider.facade';
import { EthereumQuickNodeProvider } from '../implementations/ethereum/ethereum-quicknode.provider';
import { ModuleRef } from '@nestjs/core';
import { ProviderDiscoveryService } from '../provider-discovery.service';
import {
  BlockchainProviderInterface,
  NetworkType,
} from '../interfaces/blockchain-provider.interface';

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

describe('ProviderFactory', () => {
  let factory: ProviderFactory;
  let mockConfigService: Partial<ConfigService>;
  let mockModuleRef: Partial<ModuleRef>;
  let mockAlchemyFacade: Partial<AlchemyProviderFacade>;
  let mockQuicknodeProvider: Partial<EthereumQuickNodeProvider>;
  let mockDiscoveryService: Partial<ProviderDiscoveryService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'blockchain.providers.ethereum') return ['alchemy', 'quicknode'];
        if (key === 'blockchain.providers.solana') return ['alchemy'];
        return null;
      }),
    };

    mockAlchemyFacade = {
      // getProviderMetadata: jest.fn().mockReturnValue({
      //   id: PROVIDER_METADATA,
      //   name: 'Alchemy',
      //   supportedChains: [ChainName.ETHEREUM, ChainName.POLYGON, ChainName.SOLANA],
      // }),
      getProviderName: jest.fn().mockReturnValue('Alchemy'),
      isSupported: jest.fn().mockReturnValue(true),
      getBaseUrl: jest.fn().mockReturnValue('https://eth-mainnet.alchemyapi.io'),
      getApiKey: jest.fn().mockReturnValue('test-api-key'),
    };

    mockQuicknodeProvider = {
      // getProviderMetadata: jest.fn().mockReturnValue({
      //   id: PROVIDER_METADATA,
      //   name: 'QuickNode',
      //   supportedChains: [ChainName.ETHEREUM],
      // }),
      getProviderName: jest.fn().mockReturnValue('QuickNode'),
      isSupported: jest.fn().mockReturnValue(true),
      getBaseUrl: jest.fn().mockReturnValue('https://eth-mainnet.quicknode.io'),
      getApiKey: jest.fn().mockReturnValue('test-api-key'),
    };

    mockModuleRef = {
      get: jest.fn().mockImplementation((token) => {
        if (token === AlchemyProviderFacade) return mockAlchemyFacade;
        if (token === EthereumQuickNodeProvider) return mockQuicknodeProvider;
        return null;
      }),
    };

    mockDiscoveryService = {
      discoverProviders: jest.fn().mockReturnValue([]),
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
      ],
    }).compile();

    factory = module.get<ProviderFactory>(ProviderFactory);
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

    it('should return empty map for unsupported chain', () => {
      (factory as any).providers = new Map();
      expect(() => factory.getProvider('UNSUPPORTED_CHAIN' as ChainName)).toThrow();
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
});
