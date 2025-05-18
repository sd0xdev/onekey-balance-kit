import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioMongoListener } from './portfolio-mongo.listener';
import { DbService } from '../db/db.service';
import { WebhookManagementService } from '../../webhook/webhook-management.service';
import { getModelToken } from '@nestjs/mongoose';
import { PortfolioSnapshot } from '../db/schemas/portfolio-snapshot.schema';
import { Model } from 'mongoose';
import { ChainName } from '../../chains/constants';
import { PortfolioRedisUpdatedEvent } from '../../notification/notification.service';
import { ProviderType } from '../../providers/constants/blockchain-types';

describe('PortfolioMongoListener', () => {
  let listener: PortfolioMongoListener;
  let dbService: DbService;
  let webhookManagementService: WebhookManagementService;
  let portfolioModel: Model<PortfolioSnapshot>;

  const mockDbService = {
    savePortfolioSnapshot: jest.fn().mockResolvedValue(true),
  };

  const mockWebhookManagementService = {
    updateWebhookAddresses: jest.fn().mockResolvedValue(true),
  };

  const mockPortfolioModel = {
    find: jest.fn(),
    updateMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioMongoListener,
        {
          provide: DbService,
          useValue: mockDbService,
        },
        {
          provide: WebhookManagementService,
          useValue: mockWebhookManagementService,
        },
        {
          provide: getModelToken(PortfolioSnapshot.name),
          useValue: mockPortfolioModel,
        },
      ],
    }).compile();

    listener = module.get<PortfolioMongoListener>(PortfolioMongoListener);
    dbService = module.get<DbService>(DbService);
    webhookManagementService = module.get<WebhookManagementService>(WebhookManagementService);
    portfolioModel = module.get<Model<PortfolioSnapshot>>(getModelToken(PortfolioSnapshot.name));

    // 為 isAddressActive 和 isAddressMonitored 添加模擬
    (listener as any).isAddressActive = jest.fn().mockResolvedValue(false);
    (listener as any).isAddressMonitored = jest.fn().mockResolvedValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('handlePortfolioRedisUpdated', () => {
    it('should transform data and save to MongoDB', async () => {
      const mockEvent: PortfolioRedisUpdatedEvent = new PortfolioRedisUpdatedEvent(
        ChainName.ETHEREUM,
        1,
        '0x123',
        {
          nativeBalance: { balance: '100', symbol: 'ETH' },
          tokens: [{ balance: '200', symbol: 'DAI' }],
        },
        ProviderType.ALCHEMY,
        86400,
      );

      // 預期轉換後的數據
      const expectedTransformedData = {
        native: { balance: '100', symbol: 'ETH' },
        fungibles: [{ balance: '200', symbol: 'DAI' }],
        blockNumber: 0,
      };

      // 模擬 updateWebhookAddresses 方法
      jest.spyOn(listener as any, 'updateWebhookAddresses').mockResolvedValue(undefined);

      await listener.handlePortfolioRedisUpdated(mockEvent);

      // 驗證 DbService 是否被正確調用
      expect(mockDbService.savePortfolioSnapshot).toHaveBeenCalledWith(
        ChainName.ETHEREUM,
        1,
        '0x123',
        expectedTransformedData,
        ProviderType.ALCHEMY,
        86400,
      );

      // 驗證 updateWebhookAddresses 是否被調用
      expect((listener as any).updateWebhookAddresses).toHaveBeenCalledWith(
        ChainName.ETHEREUM,
        '0x123',
      );
    });

    it('should handle data that is already in the correct format', async () => {
      const mockEvent: PortfolioRedisUpdatedEvent = new PortfolioRedisUpdatedEvent(
        ChainName.ETHEREUM,
        1,
        '0x123',
        {
          native: { balance: '100', symbol: 'ETH' },
          fungibles: [{ balance: '200', symbol: 'DAI' }],
          blockNumber: 12345,
        },
        ProviderType.ALCHEMY,
        86400,
      );

      await listener.handlePortfolioRedisUpdated(mockEvent);

      // 驗證原始數據被保留
      expect(mockDbService.savePortfolioSnapshot).toHaveBeenCalledWith(
        ChainName.ETHEREUM,
        1,
        '0x123',
        mockEvent.portfolioData,
        ProviderType.ALCHEMY,
        86400,
      );
    });

    it('should handle errors gracefully', async () => {
      const mockEvent: PortfolioRedisUpdatedEvent = new PortfolioRedisUpdatedEvent(
        ChainName.ETHEREUM,
        1,
        '0x123',
        {
          native: { balance: '100', symbol: 'ETH' },
        },
        ProviderType.ALCHEMY,
        86400,
      );

      // 模擬 DbService 拋出錯誤
      mockDbService.savePortfolioSnapshot.mockRejectedValue(new Error('Database error'));

      // 不應該拋出錯誤
      await expect(listener.handlePortfolioRedisUpdated(mockEvent)).resolves.not.toThrow();
    });
  });

  describe('updateWebhookAddresses', () => {
    it('should skip if chain was recently processed', async () => {
      // 先調用一次設置處理時間戳
      await (listener as any).updateWebhookAddresses(ChainName.ETHEREUM);

      // 清除模擬記錄
      mockWebhookManagementService.updateWebhookAddresses.mockClear();

      // 再次調用，應該跳過處理
      await (listener as any).updateWebhookAddresses(ChainName.ETHEREUM);

      expect(mockWebhookManagementService.updateWebhookAddresses).not.toHaveBeenCalled();
    });

    it('should process specific address if provided', async () => {
      // 模擬 isAddressActive 返回 true
      (listener as any).isAddressActive = jest.fn().mockResolvedValue(true);
      // 模擬 isAddressMonitored 返回 false
      (listener as any).isAddressMonitored = jest.fn().mockResolvedValue(false);

      await (listener as any).updateWebhookAddresses(ChainName.ETHEREUM, '0x123');

      // 驗證只添加這個地址
      expect(mockWebhookManagementService.updateWebhookAddresses).toHaveBeenCalledWith(
        ChainName.ETHEREUM,
        ['0x123'],
        [],
      );
    });

    it('should remove address from monitoring if expired', async () => {
      // 模擬 isAddressActive 返回 false
      (listener as any).isAddressActive = jest.fn().mockResolvedValue(false);
      // 模擬 isAddressMonitored 返回 true
      (listener as any).isAddressMonitored = jest.fn().mockResolvedValue(true);

      await (listener as any).updateWebhookAddresses(ChainName.ETHEREUM, '0x123');

      // 驗證從監控中移除這個地址
      expect(mockWebhookManagementService.updateWebhookAddresses).toHaveBeenCalledWith(
        ChainName.ETHEREUM,
        [],
        ['0x123'],
      );
    });

    it('should process all chain addresses if no specific address provided', async () => {
      // 模擬獲取活躍和過期地址
      jest.spyOn(listener as any, 'getActiveAddresses').mockResolvedValue(['0x123', '0x456']);
      jest.spyOn(listener as any, 'getExpiredAddresses').mockResolvedValue(['0x789']);

      await (listener as any).updateWebhookAddresses(ChainName.ETHEREUM);

      // 驗證同時處理所有活躍和過期地址
      expect(mockWebhookManagementService.updateWebhookAddresses).toHaveBeenCalledWith(
        ChainName.ETHEREUM,
        ['0x123', '0x456'],
        ['0x789'],
      );
    });

    it('should handle errors gracefully', async () => {
      // 模擬拋出錯誤
      jest.spyOn(listener as any, 'getActiveAddresses').mockRejectedValue(new Error('Fetch error'));

      // 不應該拋出錯誤
      await expect(
        (listener as any).updateWebhookAddresses(ChainName.ETHEREUM),
      ).resolves.not.toThrow();
    });
  });

  describe('getActiveAddresses', () => {
    it('should return active addresses not yet monitored', async () => {
      const mockActiveAddresses = [{ address: '0x123' }, { address: '0x456' }];

      mockPortfolioModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockActiveAddresses),
      });

      const result = await (listener as any).getActiveAddresses(ChainName.ETHEREUM);

      expect(result).toEqual(['0x123', '0x456']);
      expect(mockPortfolioModel.find).toHaveBeenCalledWith({
        chain: ChainName.ETHEREUM,
        expiresAt: { $gt: expect.any(Date) },
        webhookMonitored: { $ne: true },
      });
    });

    it('should handle errors and return empty array', async () => {
      mockPortfolioModel.find.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await (listener as any).getActiveAddresses(ChainName.ETHEREUM);

      expect(result).toEqual([]);
    });
  });

  describe('markAddressesAsMonitored', () => {
    it('should update database to mark addresses as monitored', async () => {
      const addresses = ['0x123', '0x456'];

      mockPortfolioModel.updateMany.mockResolvedValue({ modifiedCount: 2 });

      await (listener as any).markAddressesAsMonitored(ChainName.ETHEREUM, addresses);

      expect(mockPortfolioModel.updateMany).toHaveBeenCalledWith(
        {
          chain: ChainName.ETHEREUM,
          address: { $in: addresses },
        },
        {
          $set: { webhookMonitored: true },
        },
      );
    });

    it('should handle errors gracefully', async () => {
      mockPortfolioModel.updateMany.mockRejectedValue(new Error('Database error'));

      // 不應該拋出錯誤
      await expect(
        (listener as any).markAddressesAsMonitored(ChainName.ETHEREUM, ['0x123']),
      ).resolves.not.toThrow();
    });
  });
});
