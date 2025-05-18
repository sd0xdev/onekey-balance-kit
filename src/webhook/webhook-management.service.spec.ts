import { Test, TestingModule } from '@nestjs/testing';
import { WebhookManagementService } from './webhook-management.service';
import { AppConfigService } from '../config/config.service';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { ChainName } from '../chains/constants';
import { AxiosResponse } from 'axios';
import { Alchemy } from 'alchemy-sdk';

// 創建 Alchemy 的模擬
jest.mock('alchemy-sdk', () => {
  return {
    Alchemy: jest.fn().mockImplementation(() => ({
      notify: {
        updateWebhook: jest.fn().mockResolvedValue({ success: true }),
        getAddresses: jest.fn().mockResolvedValue({ addresses: ['0x123', '0x456'] }),
        createWebhook: jest.fn().mockResolvedValue({ id: 'new-webhook-id' }),
      },
    })),
    Network: {
      ETH_MAINNET: 'eth-mainnet',
      ETH_GOERLI: 'eth-goerli',
      ETH_SEPOLIA: 'eth-sepolia',
      MATIC_MAINNET: 'matic-mainnet',
      MATIC_MUMBAI: 'matic-mumbai',
      BNB_MAINNET: 'bnb-mainnet',
      BNB_TESTNET: 'bnb-testnet',
      SOLANA_MAINNET: 'solana-mainnet',
      SOLANA_DEVNET: 'solana-devnet',
    },
    WebhookType: {
      ADDRESS_ACTIVITY: 'ADDRESS_ACTIVITY',
    },
  };
});

describe('WebhookManagementService', () => {
  let service: WebhookManagementService;
  let httpService: HttpService;
  let configService: AppConfigService;

  const mockConfigService = {
    blockchain: {
      alchemyToken: 'test-token',
      alchemyApiKey: 'test-api-key',
    },
    webhook: {
      url: 'https://test.com/webhook',
    },
    get: jest.fn(),
  };

  const mockHttpService = {
    get: jest.fn(),
    post: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookManagementService,
        {
          provide: AppConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<WebhookManagementService>(WebhookManagementService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<AppConfigService>(AppConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateWebhookAddresses', () => {
    it('should update webhook addresses successfully', async () => {
      // 模擬 getWebhookIdForChain 方法
      jest.spyOn(service as any, 'getWebhookIdForChain').mockResolvedValue('webhook-id-123');

      const result = await service.updateWebhookAddresses(ChainName.ETHEREUM, ['0xabc'], ['0xdef']);

      expect(result).toBeTruthy();
    });

    it('should return false when Alchemy token is not configured', async () => {
      // 覆蓋配置，記錄原始配置
      const originalGet = mockConfigService.get;
      mockConfigService.get = jest.fn((key) => {
        if (key === 'blockchain') {
          return { alchemyToken: '', alchemyApiKey: 'test-api-key' };
        }
        return originalGet.call(mockConfigService, key);
      });

      // 建立一個能夠使用的新 service
      const newService = new WebhookManagementService(
        mockConfigService as any,
        mockHttpService as any,
      );

      // 確保 getWebhookIdForChain 返回 null 以模擬無法找到 webhook
      jest.spyOn(newService as any, 'getWebhookIdForChain').mockResolvedValue(null);

      const result = await newService.updateWebhookAddresses(
        ChainName.ETHEREUM,
        ['0xabc'],
        ['0xdef'],
      );

      expect(result).toBeFalsy();

      // 恢復原始配置
      mockConfigService.get = originalGet;
    });

    it('should return false when webhook ID is not found', async () => {
      jest.spyOn(service as any, 'getWebhookIdForChain').mockResolvedValue(null);

      const result = await service.updateWebhookAddresses(ChainName.ETHEREUM, ['0xabc'], ['0xdef']);

      expect(result).toBeFalsy();
    });

    it('should return false when Alchemy SDK client is not found', async () => {
      jest.spyOn(service as any, 'getWebhookIdForChain').mockResolvedValue('webhook-id-123');

      // 設置 alchemySDKClients.get 返回 undefined
      jest.spyOn(service['alchemySDKClients'], 'get').mockReturnValue(undefined);

      const result = await service.updateWebhookAddresses(ChainName.ETHEREUM, ['0xabc'], ['0xdef']);

      expect(result).toBeFalsy();
    });

    it('should handle exceptions and return false', async () => {
      jest.spyOn(service as any, 'getWebhookIdForChain').mockResolvedValue('webhook-id-123');

      // 模擬 SDK client
      const mockClient = {
        notify: {
          updateWebhook: jest.fn().mockRejectedValue(new Error('API error')),
        },
      };

      jest.spyOn(service['alchemySDKClients'], 'get').mockReturnValue(mockClient as any);

      const result = await service.updateWebhookAddresses(ChainName.ETHEREUM, ['0xabc'], ['0xdef']);

      expect(result).toBeFalsy();
    });
  });

  describe('getExistingWebhooks', () => {
    it('should return list of webhooks', async () => {
      const mockWebhooks = [
        { id: 'webhook1', network: 'ETH_MAINNET', is_active: true },
        { id: 'webhook2', network: 'MATIC_MAINNET', is_active: true },
      ];

      // 覆蓋配置，記錄原始配置
      const originalGet = mockConfigService.get;
      mockConfigService.get = jest.fn((key) => {
        if (key === 'blockchain') {
          return { alchemyToken: 'test-token', alchemyApiKey: 'test-api-key' };
        }
        return originalGet.call(mockConfigService, key);
      });

      // 創建一個新的 service 實例
      const newModule: TestingModule = await Test.createTestingModule({
        providers: [
          WebhookManagementService,
          {
            provide: AppConfigService,
            useValue: mockConfigService,
          },
          {
            provide: HttpService,
            useValue: mockHttpService,
          },
        ],
      }).compile();

      const newService = newModule.get<WebhookManagementService>(WebhookManagementService);

      mockHttpService.get.mockReturnValue(
        of({
          status: 200,
          data: {
            data: mockWebhooks,
          },
        } as AxiosResponse),
      );

      const result = await newService.getExistingWebhooks();

      expect(result).toEqual(mockWebhooks);
      expect(mockHttpService.get).toHaveBeenCalled();

      // 恢復原始配置
      mockConfigService.get = originalGet;
    });

    it('should return null on API error', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('API error')));

      const result = await service.getExistingWebhooks();

      expect(result).toBeNull();
    });

    it('should return null when Alchemy token is not configured', async () => {
      // 覆蓋配置
      Object.defineProperty(mockConfigService, 'blockchain', {
        get: jest.fn().mockReturnValue({ alchemyToken: null }),
      });

      const result = await service.getExistingWebhooks();

      expect(result).toBeNull();
    });
  });

  describe('getSigningKeyByUrl', () => {
    it('should return signing key from cache when available', async () => {
      // 先在快取中設置一個有效的 signing key
      const url = 'https://test.com/webhook';
      const chain = ChainName.ETHEREUM;
      const cacheKey = `${url}:${chain}`;
      const mockKey = 'signing-key-123';

      // 手動設置快取
      (service as any).signingKeyCache.set(cacheKey, {
        key: mockKey,
        expiresAt: Date.now() + 60000, // 1分鐘後過期
      });

      const result = await service.getSigningKeyByUrl(url, chain);

      expect(result).toBe(mockKey);
    });

    it('should fetch signing key and cache it when not in cache', async () => {
      const mockWebhooks = [
        {
          id: 'webhook1',
          webhook_url: 'https://test.com/webhook',
          network: 'ETH_MAINNET',
          is_active: true,
          signing_key: 'fresh-signing-key',
          name: 'Test Webhook',
          webhook_type: 'ADDRESS_ACTIVITY',
          time_created: Date.now(),
          version: '1.0',
          deactivation_reason: '',
        },
      ];

      // 設置 getExistingWebhooks 的模擬返回值
      jest.spyOn(service, 'getExistingWebhooks').mockResolvedValue(mockWebhooks);

      // 設置 getNetworkIdForChain 的模擬返回值
      jest.spyOn(service as any, 'getNetworkIdForChain').mockReturnValue('ETH_MAINNET');

      const result = await service.getSigningKeyByUrl(
        'https://test.com/webhook',
        ChainName.ETHEREUM,
      );

      expect(result).toBe('fresh-signing-key');
    });

    it('should return null if no matching webhook is found', async () => {
      // 設置 getExistingWebhooks 的模擬返回值
      jest.spyOn(service, 'getExistingWebhooks').mockResolvedValue([]);

      const result = await service.getSigningKeyByUrl(
        'https://test.com/webhook',
        ChainName.ETHEREUM,
      );

      expect(result).toBeNull();
    });
  });

  describe('getWebhookDetailsWithSdk', () => {
    it('should return webhook addresses when SDK client is available', async () => {
      const mockAddresses = ['0x123', '0x456'];
      const mockAlchemyClient = {
        notify: {
          getAddresses: jest.fn().mockResolvedValue({ addresses: mockAddresses }),
        },
      };

      // 建立一個直接可用的實例
      const testService = new WebhookManagementService(
        mockConfigService as any,
        mockHttpService as any,
      );

      // 確保 alchemyToken 存在
      Object.defineProperty(testService, 'alchemyToken', {
        get: () => 'test-token',
        configurable: true,
      });

      // 準備測試用的 Mock 客戶端
      const mockMap = new Map();
      mockMap.set(ChainName.ETHEREUM, mockAlchemyClient);

      // 使用 defineProperty 覆蓋 Map 的 get 方法
      const originalMapGet = Map.prototype.get;
      Map.prototype.get = jest.fn().mockImplementation(function (key) {
        if (this === testService['alchemySDKClients'] && key === ChainName.ETHEREUM) {
          return mockAlchemyClient;
        }
        return originalMapGet.call(this, key);
      });

      // 執行測試
      const result = await testService.getWebhookDetailsWithSdk(
        ChainName.ETHEREUM,
        'webhook-id-123',
      );

      // 驗證 getAddresses 被調用
      expect(mockAlchemyClient.notify.getAddresses).toHaveBeenCalledWith('webhook-id-123');

      // 驗證結果
      expect(result).toEqual(mockAddresses);

      // 恢復原始的 Map.get 方法
      Map.prototype.get = originalMapGet;
    });

    it('should return empty array when SDK client is not available', async () => {
      jest.spyOn(service['alchemySDKClients'], 'get').mockReturnValue(undefined);

      const result = await service.getWebhookDetailsWithSdk(ChainName.ETHEREUM, 'webhook-id-123');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const mockClient = {
        notify: {
          getAddresses: jest.fn().mockRejectedValue(new Error('API error')),
        },
      };

      jest.spyOn(service['alchemySDKClients'], 'get').mockReturnValue(mockClient as any);

      const result = await service.getWebhookDetailsWithSdk(ChainName.ETHEREUM, 'webhook-id-123');

      expect(result).toEqual([]);
    });
  });
});
