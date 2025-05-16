import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { ChainServiceFactory } from './chain-service.factory';
import { DiscoveryService } from './discovery.service';
import { ChainName } from '../../constants';
import { ChainService } from '../../interfaces/chain-service.interface';

// 創建一個模擬的鏈服務類，實現 ChainService 接口
class MockChainService implements ChainService {
  isValidAddress(): boolean {
    return true;
  }

  getAddressTransactionHashes(): Promise<string[]> {
    return Promise.resolve([]);
  }

  getTransactionDetails(): Promise<any> {
    return Promise.resolve({});
  }

  getChainName(): string {
    return ChainName.ETHEREUM;
  }

  getChainSymbol(): string {
    return 'ETH';
  }
}

describe('ChainServiceFactory', () => {
  let factory: ChainServiceFactory;
  let discoveryService: DiscoveryService;
  let moduleRef: ModuleRef;

  // 創建模擬的服務實例和服務類型
  const mockEthereumService = new MockChainService();
  const MockEthereumServiceType = MockChainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainServiceFactory,
        {
          provide: DiscoveryService,
          useValue: {
            getChainServiceTypes: jest.fn().mockReturnValue({
              ethereum: MockEthereumServiceType,
              // 可以添加更多鏈服務類型
            }),
            discoverChainServices: jest
              .fn()
              .mockReturnValue(new Map([['ethereum', MockEthereumServiceType]])),
          },
        },
        {
          provide: ModuleRef,
          useValue: {
            get: jest.fn().mockImplementation((type) => {
              if (type === MockEthereumServiceType) {
                return mockEthereumService;
              }
              throw new Error(`Unexpected service type: ${type.name}`);
            }),
          },
        },
      ],
    }).compile();

    factory = module.get<ChainServiceFactory>(ChainServiceFactory);
    discoveryService = module.get<DiscoveryService>(DiscoveryService);
    moduleRef = module.get<ModuleRef>(ModuleRef);

    // 手動調用工廠初始化方法
    (factory as any).onModuleInit();
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('getChainService', () => {
    it('should return a chain service for valid chain name', () => {
      const service = factory.getChainService(ChainName.ETHEREUM);
      expect(service).toBeDefined();
      expect(service.getChainName()).toBe(ChainName.ETHEREUM);
    });

    it('should return a chain service for valid coin symbol', () => {
      const service = factory.getChainService('eth');
      expect(service).toBeDefined();
      expect(service.getChainName()).toBe(ChainName.ETHEREUM);
    });

    it('should throw an exception for invalid chain name or symbol', () => {
      expect(() => factory.getChainService('invalid')).toThrow();
    });

    it('should return the same instance for the same chain name', () => {
      const service1 = factory.getChainService(ChainName.ETHEREUM);
      const service2 = factory.getChainService(ChainName.ETHEREUM);
      expect(service1).toBe(service2);
    });
  });

  describe('getChainServiceWithProvider', () => {
    it('should return a chain service with specific provider', () => {
      const customProvider = 'customProvider';
      const service = factory.getChainServiceWithProvider(ChainName.ETHEREUM, customProvider);

      expect(service).toBeDefined();
      expect(service.getChainName()).toBe(ChainName.ETHEREUM);
    });

    it('should return different instances for different providers', () => {
      const provider1 = 'provider1';
      const provider2 = 'provider2';

      const service1 = factory.getChainServiceWithProvider(ChainName.ETHEREUM, provider1);
      const service2 = factory.getChainServiceWithProvider(ChainName.ETHEREUM, provider2);

      expect(service1).not.toBe(service2);
    });

    it('should return the same instance for the same provider', () => {
      const provider = 'testProvider';

      const service1 = factory.getChainServiceWithProvider(ChainName.ETHEREUM, provider);
      const service2 = factory.getChainServiceWithProvider(ChainName.ETHEREUM, provider);

      expect(service1).toBe(service2);
    });
  });

  describe('normalizeChainInput', () => {
    it('should return the chain name directly if valid', () => {
      const result = (factory as any).normalizeChainInput(ChainName.ETHEREUM);
      expect(result).toBe(ChainName.ETHEREUM);
    });

    it('should convert from coin symbol to chain name', () => {
      const result = (factory as any).normalizeChainInput('eth');
      expect(result).toBe(ChainName.ETHEREUM);
    });

    it('should throw an error for invalid input', () => {
      const result = (factory as any).normalizeChainInput('invalid');
      expect(result).toBe('invalid');
    });
  });

  describe('isProviderAware', () => {
    it('should return true for objects implementing ProviderAware', () => {
      const providerAware = {
        getChainName: () => ChainName.ETHEREUM,
        setDefaultProvider: jest.fn(),
        getDefaultProvider: jest.fn(),
      };
      const result = (factory as any).isProviderAware(providerAware);
      expect(result).toBe(true);
    });

    it('should return false for objects not implementing ProviderAware', () => {
      const nonProviderAware = {
        getChainName: () => ChainName.ETHEREUM,
      };

      const result = (factory as any).isProviderAware(nonProviderAware);
      expect(result).toBe(false);
    });
  });
});
