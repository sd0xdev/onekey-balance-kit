import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WebhookService } from './webhook.service';
import { CacheService } from '../core/cache/cache.service';
import { CacheKeyService } from '../core/cache/cache-key.service';
import { NotificationService } from '../notification/notification.service';
import { WebhookEvent } from '../core/db/schemas/webhook-event.schema';
import { Model } from 'mongoose';
import { WebhookEventDto, WebhookEventType } from './dto/webhook-event.dto';
import { ChainName } from '../chains/constants';

// 模擬 getChainIdFromNetworkId 函數
jest.mock('../chains/constants', () => ({
  ...jest.requireActual('../chains/constants'),
  getChainIdFromNetworkId: jest.fn((network) => {
    if (network === 'ethereum') return 1;
    if (network === 'solana') return 101;
    return null;
  }),
  NETWORK_ID_TO_CHAIN_MAP: {
    ethereum: 'ethereum',
    solana: 'solana',
  },
  ChainName: {
    ETHEREUM: 'ethereum',
    SOLANA: 'solana',
  },
}));

describe('WebhookService', () => {
  let service: WebhookService;
  let cacheService: CacheService;
  let cacheKeyService: CacheKeyService;
  let notificationService: NotificationService;
  let webhookEventModel: Model<WebhookEvent>;

  // 模擬資料
  const mockWebhookEventModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    deleteOne: jest.fn(),
  };

  const mockCacheService = {
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  };

  const mockCacheKeyService = {
    generateKey: jest.fn(),
  };

  const mockNotificationService = {
    emitAddressActivity: jest.fn(),
    emitNftActivity: jest.fn(),
    emitTransactionMined: jest.fn(),
    emitCustomEvent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: CacheService, useValue: mockCacheService },
        { provide: CacheKeyService, useValue: mockCacheKeyService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: getModelToken(WebhookEvent.name), useValue: mockWebhookEventModel },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    cacheService = module.get<CacheService>(CacheService);
    cacheKeyService = module.get<CacheKeyService>(CacheKeyService);
    notificationService = module.get<NotificationService>(NotificationService);
    webhookEventModel = module.get<Model<WebhookEvent>>(getModelToken(WebhookEvent.name));

    // 模擬 mapNetworkToChainType 方法，確保它返回有效的鏈類型
    jest.spyOn(service as any, 'mapNetworkToChainType').mockImplementation((network) => {
      if (network === 'ethereum') return ChainName.ETHEREUM;
      if (network === 'solana') return ChainName.SOLANA;
      return null;
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processWebhookEvent', () => {
    const mockAddressActivityEvent: WebhookEventDto = {
      id: 'event-123',
      webhookId: 'webhook-123',
      createdAt: new Date().toISOString(),
      type: WebhookEventType.ADDRESS_ACTIVITY,
      event: {
        network: 'ethereum',
        activity: [
          {
            fromAddress: '0x111',
            toAddress: '0x123456789',
            blockNum: '12345',
            hash: '0xabcdef',
            category: 'token',
          },
        ],
      },
    };

    it('should save event to database and process address activity', async () => {
      mockWebhookEventModel.create.mockResolvedValue({});

      const result = await service.processWebhookEvent(mockAddressActivityEvent);

      expect(result).toBe(true);
      expect(mockWebhookEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockAddressActivityEvent.id,
          type: mockAddressActivityEvent.type,
        }),
      );
      expect(mockNotificationService.emitAddressActivity).toHaveBeenCalled();
    });

    it('should handle database save error', async () => {
      mockWebhookEventModel.create.mockRejectedValue(new Error('DB error'));

      await expect(service.processWebhookEvent(mockAddressActivityEvent)).rejects.toThrow();
      expect(mockNotificationService.emitAddressActivity).not.toHaveBeenCalled();
    });

    it('should handle unknown event type', async () => {
      const mockUnknownEvent = {
        ...mockAddressActivityEvent,
        type: 'UNKNOWN_TYPE' as WebhookEventType,
      };

      mockWebhookEventModel.create.mockResolvedValue({});

      await service.processWebhookEvent(mockUnknownEvent);

      expect(mockWebhookEventModel.create).toHaveBeenCalled();
      expect(mockNotificationService.emitAddressActivity).not.toHaveBeenCalled();
    });
  });

  describe('handleAddressActivity (via processWebhookEvent)', () => {
    const mockEvent: WebhookEventDto = {
      id: 'event-123',
      webhookId: 'webhook-123',
      createdAt: new Date().toISOString(),
      type: WebhookEventType.ADDRESS_ACTIVITY,
      event: {
        network: 'ethereum',
        activity: [
          {
            fromAddress: '0x111',
            toAddress: '0x222',
            blockNum: '12345',
            hash: '0xabcdef',
            category: 'token',
          },
        ],
      },
    };

    it('should emit notifications for both from and to addresses', async () => {
      mockWebhookEventModel.create.mockResolvedValue({});

      await service.processWebhookEvent(mockEvent);

      expect(mockNotificationService.emitAddressActivity).toHaveBeenCalledTimes(2);
      // fromAddress
      expect(mockNotificationService.emitAddressActivity).toHaveBeenCalledWith(
        'ethereum',
        1, // chainId for ethereum
        '0x111',
        expect.objectContaining({ txHash: '0xabcdef' }),
      );
      // toAddress
      expect(mockNotificationService.emitAddressActivity).toHaveBeenCalledWith(
        'ethereum',
        1, // chainId for ethereum
        '0x222',
        expect.objectContaining({ txHash: '0xabcdef' }),
      );
    });
  });

  describe('handleNftActivity (via processWebhookEvent)', () => {
    const mockEvent: WebhookEventDto = {
      id: 'event-123',
      webhookId: 'webhook-123',
      createdAt: new Date().toISOString(),
      type: WebhookEventType.NFT_ACTIVITY,
      event: {
        network: 'ethereum',
        activity: [
          {
            fromAddress: '0x111',
            toAddress: '0x222',
            contractAddress: '0xcontract',
            erc721TokenId: '123',
            category: 'erc721',
          },
        ],
      },
    };

    it('should emit NFT activity notification', async () => {
      mockWebhookEventModel.create.mockResolvedValue({});

      await service.processWebhookEvent(mockEvent);

      expect(mockNotificationService.emitNftActivity).toHaveBeenCalledWith(
        'ethereum',
        '0xcontract',
        '123',
        '0x111',
        '0x222',
      );

      // 還應該為 fromAddress 和 toAddress 發出地址活動通知
      expect(mockNotificationService.emitAddressActivity).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleMinedTransaction (via processWebhookEvent)', () => {
    const mockEvent: WebhookEventDto = {
      id: 'event-123',
      webhookId: 'webhook-123',
      createdAt: new Date().toISOString(),
      type: WebhookEventType.MINED_TRANSACTION,
      event: {
        network: 'ethereum',
        hash: '0xabcdef',
        from: '0x111',
        to: '0x222',
        blockNum: '12345',
        status: 'success',
        gasUsed: '21000',
      },
    };

    it('should emit transaction mined notification', async () => {
      mockWebhookEventModel.create.mockResolvedValue({});

      await service.processWebhookEvent(mockEvent);

      expect(mockNotificationService.emitTransactionMined).toHaveBeenCalledWith(
        'ethereum',
        '0xabcdef',
        '0x111',
        '0x222',
      );

      // 還應該為 from 和 to 地址發出地址活動通知
      expect(mockNotificationService.emitAddressActivity).toHaveBeenCalledTimes(2);
    });
  });
});
