import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioMongoListener } from './portfolio-mongo.listener';
import { WebhookManagementService } from '../../webhook/webhook-management.service';
import { getModelToken } from '@nestjs/mongoose';
import { PortfolioSnapshot } from '../db/schemas/portfolio-snapshot.schema';
import { Model } from 'mongoose';
import { ChainName } from '../../chains/constants';
import { PortfolioRedisUpdatedEvent } from '../../notification/notification.service';
import { ProviderType } from '../../providers/constants/blockchain-types';

describe('PortfolioMongoListener (Cache)', () => {
  let listener: PortfolioMongoListener;
  let webhookManagementService: WebhookManagementService;
  let portfolioModel: Model<PortfolioSnapshot>;

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
    webhookManagementService = module.get<WebhookManagementService>(WebhookManagementService);
    portfolioModel = module.get<Model<PortfolioSnapshot>>(getModelToken(PortfolioSnapshot.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('handlePortfolioRedisUpdate', () => {
    it('should update webhook addresses when portfolio data is updated in Redis', async () => {
      const mockEvent: PortfolioRedisUpdatedEvent = new PortfolioRedisUpdatedEvent(
        ChainName.ETHEREUM,
        1,
        '0x123',
        {
          native: { balance: '100', symbol: 'ETH' },
        },
        ProviderType.ALCHEMY,
      );

      // 模擬獲取活躍和過期地址
      jest.spyOn(listener as any, 'getActiveAddresses').mockResolvedValue(['0x123', '0x456']);
      jest.spyOn(listener as any, 'getExpiredAddresses').mockResolvedValue(['0x789']);

      await listener.handlePortfolioRedisUpdate(mockEvent);

      // 驗證更新 webhook 地址
      expect(mockWebhookManagementService.updateWebhookAddresses).toHaveBeenCalledWith(
        ChainName.ETHEREUM,
        ['0x123', '0x456'],
        ['0x789'],
      );
    });

    it('should skip processing if chain was recently processed', async () => {
      const mockEvent: PortfolioRedisUpdatedEvent = new PortfolioRedisUpdatedEvent(
        ChainName.ETHEREUM,
        1,
        '0x123',
        {
          native: { balance: '100', symbol: 'ETH' },
        },
        ProviderType.ALCHEMY,
      );

      // 先調用一次設置處理時間戳
      await listener.handlePortfolioRedisUpdate(mockEvent);

      // 清除模擬記錄
      mockWebhookManagementService.updateWebhookAddresses.mockClear();

      // 再次調用，應該跳過處理
      await listener.handlePortfolioRedisUpdate(mockEvent);

      expect(mockWebhookManagementService.updateWebhookAddresses).not.toHaveBeenCalled();
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
      );

      // 模擬獲取地址時拋出錯誤
      jest
        .spyOn(listener as any, 'getActiveAddresses')
        .mockRejectedValue(new Error('Database error'));

      // 不應該拋出錯誤
      await expect(listener.handlePortfolioRedisUpdate(mockEvent)).resolves.not.toThrow();
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

  describe('getExpiredAddresses', () => {
    it('should return expired addresses that are still monitored', async () => {
      const mockExpiredAddresses = [{ address: '0x789' }, { address: '0xabc' }];

      mockPortfolioModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockExpiredAddresses),
      });

      const result = await (listener as any).getExpiredAddresses(ChainName.ETHEREUM);

      expect(result).toEqual(['0x789', '0xabc']);
      expect(mockPortfolioModel.find).toHaveBeenCalledWith({
        chain: ChainName.ETHEREUM,
        expiresAt: { $lte: expect.any(Date) },
        webhookMonitored: true,
      });
    });

    it('should handle errors and return empty array', async () => {
      mockPortfolioModel.find.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await (listener as any).getExpiredAddresses(ChainName.ETHEREUM);

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

  describe('unmarkExpiredAddresses', () => {
    it('should update database to unmark addresses', async () => {
      const addresses = ['0x789', '0xabc'];

      mockPortfolioModel.updateMany.mockResolvedValue({ modifiedCount: 2 });

      await (listener as any).unmarkExpiredAddresses(ChainName.ETHEREUM, addresses);

      expect(mockPortfolioModel.updateMany).toHaveBeenCalledWith(
        {
          chain: ChainName.ETHEREUM,
          address: { $in: addresses },
        },
        {
          $unset: { webhookMonitored: 1 },
        },
      );
    });

    it('should handle errors gracefully', async () => {
      mockPortfolioModel.updateMany.mockRejectedValue(new Error('Database error'));

      // 不應該拋出錯誤
      await expect(
        (listener as any).unmarkExpiredAddresses(ChainName.ETHEREUM, ['0x789']),
      ).resolves.not.toThrow();
    });
  });
});
