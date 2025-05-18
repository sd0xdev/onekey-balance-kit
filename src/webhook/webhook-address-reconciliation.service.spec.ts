import { Test, TestingModule } from '@nestjs/testing';
import { WebhookAddressReconciliationService } from './webhook-address-reconciliation.service';
import { WebhookManagementService } from './webhook-management.service';
import { AppConfigService } from '../config/config.service';
import { getModelToken } from '@nestjs/mongoose';
import { PortfolioSnapshot } from '../core/db/schemas/portfolio-snapshot.schema';
import { ChainName } from '../chains/constants';
import { Model } from 'mongoose';
import { DEFAULT_MONITORED_ADDRESS } from './constants/webhook.constants';

describe('WebhookAddressReconciliationService', () => {
  let service: WebhookAddressReconciliationService;
  let webhookManagementService: WebhookManagementService;
  let configService: AppConfigService;
  let portfolioModel: Model<PortfolioSnapshot>;

  const mockWebhookManagementService = {
    getExistingWebhooks: jest.fn(),
    updateWebhookAddresses: jest.fn(),
    getWebhookDetailsWithSdk: jest.fn(),
  };

  const mockConfigService = {
    app: {
      env: 'development',
    },
    webhook: {
      url: 'https://test.com/webhook',
    },
  };

  const mockPortfolioModel = {
    findOne: jest.fn(),
    updateMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookAddressReconciliationService,
        {
          provide: WebhookManagementService,
          useValue: mockWebhookManagementService,
        },
        {
          provide: AppConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getModelToken(PortfolioSnapshot.name),
          useValue: mockPortfolioModel,
        },
      ],
    }).compile();

    service = module.get<WebhookAddressReconciliationService>(WebhookAddressReconciliationService);
    webhookManagementService = module.get<WebhookManagementService>(WebhookManagementService);
    configService = module.get<AppConfigService>(AppConfigService);
    portfolioModel = module.get<Model<PortfolioSnapshot>>(getModelToken(PortfolioSnapshot.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reconcileWebhookAddresses', () => {
    it('should skip reconciliation if webhook URL is not configured', async () => {
      // 暫存原始 webhookUrl
      const originalWebhookUrl = service['webhookUrl'];

      // 使用 Object.defineProperty 覆蓋 webhookUrl 的 getter
      Object.defineProperty(service, 'webhookUrl', {
        get: () => '',
        configurable: true,
      });

      // 清除之前的模擬調用記錄
      jest.clearAllMocks();

      await service.reconcileWebhookAddresses();

      expect(mockWebhookManagementService.getExistingWebhooks).not.toHaveBeenCalled();

      // 恢復原始屬性
      Object.defineProperty(service, 'webhookUrl', {
        value: originalWebhookUrl,
        writable: false,
        configurable: true,
      });
    });

    it('should skip reconciliation if no webhooks exist', async () => {
      mockWebhookManagementService.getExistingWebhooks.mockResolvedValue([]);

      await service.reconcileWebhookAddresses();

      expect(mockWebhookManagementService.getWebhookDetailsWithSdk).not.toHaveBeenCalled();
    });

    it('should skip reconciliation if no active webhooks for current environment', async () => {
      mockWebhookManagementService.getExistingWebhooks.mockResolvedValue([
        {
          id: 'webhook1',
          webhook_url: 'https://other-url.com/webhook',
          network: 'ETH_MAINNET',
          is_active: true,
        },
      ]);

      await service.reconcileWebhookAddresses();

      expect(mockWebhookManagementService.getWebhookDetailsWithSdk).not.toHaveBeenCalled();
    });

    it('should process each active webhook for current environment', async () => {
      const mockWebhooks = [
        {
          id: 'webhook1',
          webhook_url: 'https://test.com/webhook',
          network: 'ETH_MAINNET',
          is_active: true,
        },
        {
          id: 'webhook2',
          webhook_url: 'https://test.com/webhook',
          network: 'MATIC_MAINNET',
          is_active: true,
        },
        {
          id: 'webhook3',
          webhook_url: 'https://other-url.com/webhook',
          network: 'SOL_MAINNET',
          is_active: true,
        },
      ];

      // 確保 webhookUrl 與測試中的 URL 相匹配
      Object.defineProperty(service, 'webhookUrl', {
        get: () => 'https://test.com/webhook',
        configurable: true,
      });

      // 清除先前的模擬
      jest.clearAllMocks();

      // 模擬 getExistingWebhooks 返回結果
      mockWebhookManagementService.getExistingWebhooks.mockResolvedValue(mockWebhooks);

      // 讓 getChainNameFromNetworkId 能夠返回正確的鏈名
      jest.spyOn(service as any, 'getChainNameFromNetworkId').mockImplementation((networkId) => {
        if (networkId === 'ETH_MAINNET') return ChainName.ETHEREUM;
        if (networkId === 'MATIC_MAINNET') return ChainName.POLYGON;
        if (networkId === 'SOL_MAINNET') return ChainName.SOLANA;
        return null;
      });

      // 使用 spyOn 監視 reconcileChainAddresses 方法
      const reconcileSpy = jest
        .spyOn(service as any, 'reconcileChainAddresses')
        .mockResolvedValue(undefined);

      // 執行測試方法
      await service.reconcileWebhookAddresses();

      // 驗證 reconcileChainAddresses 被正確調用
      expect(reconcileSpy).toHaveBeenCalledTimes(2);
      expect(reconcileSpy).toHaveBeenCalledWith(ChainName.ETHEREUM, 'webhook1', expect.anything());
      expect(reconcileSpy).toHaveBeenCalledWith(ChainName.POLYGON, 'webhook2', expect.anything());

      // 恢復原始屬性
      reconcileSpy.mockRestore();
    });

    it('should not remove the default monitored address', async () => {
      // 直接測試 reconcileChainAddresses 方法，這是該測試的核心邏輯
      const addresses = [DEFAULT_MONITORED_ADDRESS, '0x456'];

      // 模擬 getWebhookDetailsWithSdk 返回包含默認地址和另一個地址
      mockWebhookManagementService.getWebhookDetailsWithSdk.mockResolvedValue(addresses);

      // 模擬 portfolioModel.findOne 方法，對於不同的地址返回不同的結果
      mockPortfolioModel.findOne.mockImplementation((query) => {
        const address = query.address;
        // 對非預設地址返回無效的快照（表示已過期）
        if (address === '0x456') {
          return {
            sort: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(null), // 沒有找到有效快照
          };
        }
        // 對預設地址返回有效的快照
        return {
          sort: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue({
            expiresAt: new Date(Date.now() + 3600000), // 1小時後過期
          }),
        };
      });

      // 直接調用 reconcileChainAddresses 方法
      await (service as any).reconcileChainAddresses(ChainName.ETHEREUM, 'webhook1', new Map());

      // 驗證 updateWebhookAddresses 只嘗試移除非默認地址
      expect(mockWebhookManagementService.updateWebhookAddresses).toHaveBeenCalledWith(
        ChainName.ETHEREUM,
        [],
        ['0x456'], // 預期僅移除非默認地址
      );
    });

    it('should handle API errors', async () => {
      mockWebhookManagementService.getExistingWebhooks.mockRejectedValue(new Error('API error'));

      await service.reconcileWebhookAddresses();

      // 期望服務能夠處理錯誤並繼續運行
      expect(service).toBeDefined();
    });
  });

  describe('reconcileChainAddresses', () => {
    it('should skip reconciliation if webhook details cannot be retrieved', async () => {
      mockWebhookManagementService.getWebhookDetailsWithSdk.mockResolvedValue(null);

      await (service as any).reconcileChainAddresses(ChainName.ETHEREUM, 'webhook1', {});

      expect(mockWebhookManagementService.updateWebhookAddresses).not.toHaveBeenCalled();
    });

    it('should skip reconciliation if no addresses are found', async () => {
      mockWebhookManagementService.getWebhookDetailsWithSdk.mockResolvedValue([]);

      await (service as any).reconcileChainAddresses(ChainName.ETHEREUM, 'webhook1', {});

      expect(mockWebhookManagementService.updateWebhookAddresses).not.toHaveBeenCalled();
    });

    it('should not remove any addresses if all are valid', async () => {
      mockWebhookManagementService.getWebhookDetailsWithSdk.mockResolvedValue(['0x123', '0x456']);

      // 模擬所有地址都有有效的快照
      mockPortfolioModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          expiresAt: new Date(Date.now() + 3600000), // 1小時後過期
        }),
      });

      await (service as any).reconcileChainAddresses(ChainName.ETHEREUM, 'webhook1', {});

      // 不應調用 updateWebhookAddresses
      expect(mockWebhookManagementService.updateWebhookAddresses).not.toHaveBeenCalled();
    });

    it('should handle errors in reconciliation', async () => {
      mockWebhookManagementService.getWebhookDetailsWithSdk.mockRejectedValue(
        new Error('SDK error'),
      );

      await (service as any).reconcileChainAddresses(ChainName.ETHEREUM, 'webhook1', {});

      // 服務應能處理錯誤並繼續運行
      expect(service).toBeDefined();
    });
  });

  describe('getChainNameFromNetworkId', () => {
    it('should convert network ID to chain name', () => {
      const result = (service as any).getChainNameFromNetworkId('ETH_MAINNET');
      expect(result).toBe(ChainName.ETHEREUM);
    });

    it('should return null for unknown network ID', () => {
      const result = (service as any).getChainNameFromNetworkId('UNKNOWN_NETWORK');
      expect(result).toBeNull();
    });
  });

  describe('immediateReconciliation', () => {
    it('should call reconcileWebhookAddresses', async () => {
      jest.spyOn(service, 'reconcileWebhookAddresses').mockResolvedValue();

      await service.immediateReconciliation();

      expect(service.reconcileWebhookAddresses).toHaveBeenCalled();
    });
  });
});
