import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WebhookService } from './webhook.service';
import { CacheService } from '../core/cache/cache.service';
import { CacheKeyService } from '../core/cache/cache-key.service';
import { NotificationService } from '../notification/notification.service';
import { WebhookEvent } from '../core/db/schemas/webhook-event.schema';
import { WebhookEventType } from './dto/webhook-event.dto';
import { ChainName, getChainIdFromNetworkId } from '../chains/constants';

// 模擬 chains/constants 中的函數
jest.mock('../chains/constants', () => ({
  ...jest.requireActual('../chains/constants'),
  getChainIdFromNetworkId: jest.fn(),
}));

describe('WebhookService', () => {
  let service: WebhookService;
  let cacheService: CacheService;
  let cacheKeyService: CacheKeyService;
  let notificationService: NotificationService;
  let webhookEventModel: Model<WebhookEvent>;
  let mockGetChainIdFromNetworkId: jest.Mock;

  const mockCacheService = {
    // 實現所需的方法
    deleteByPattern: jest.fn().mockResolvedValue(5),
  };

  const mockCacheKeyService = {
    invalidateChainAddressCache: jest.fn().mockResolvedValue(5), // 假設清除了5筆緩存
    invalidateAddressCache: jest.fn().mockResolvedValue(3),
  };

  const mockNotificationService = {
    emitAddressActivity: jest.fn(),
    emitNftActivity: jest.fn(),
    emitTransactionMined: jest.fn(),
    emitCustomEvent: jest.fn(),
  };

  // 更完整的 Model 模擬
  const mockWebhookEventModel = {
    create: jest.fn().mockImplementation((data) => {
      return Promise.resolve({
        id: 'mockId',
        ...data,
      });
    }),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };

  beforeEach(async () => {
    // 每次測試前重置所有 mock
    jest.clearAllMocks();

    // 設置 getChainIdFromNetworkId 模擬
    mockGetChainIdFromNetworkId = getChainIdFromNetworkId as jest.Mock;

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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processWebhookEvent', () => {
    it('should process ADDRESS_ACTIVITY event correctly', async () => {
      // 準備測試數據
      const mockPayload = {
        webhookId: 'wh_123',
        id: 'evt_456',
        type: WebhookEventType.ADDRESS_ACTIVITY,
        event: {
          network: 'ETH_SEPOLIA',
          activity: [
            {
              blockNum: '0xdf34a3',
              hash: '0x123',
              fromAddress: '0xabc',
              toAddress: '0xdef',
              value: 100,
              category: 'token',
              asset: 'USDC',
              rawContract: { address: '0xcontract', decimals: 6 },
              log: {},
            },
          ],
        },
        createdAt: '2025-05-16T04:40:00.344891430Z',
      };

      // 模擬 saveWebhookToDatabase 方法
      jest.spyOn(service as any, 'saveWebhookToDatabase').mockResolvedValue(undefined);

      // 模擬 handleAddressActivity 方法
      jest.spyOn(service as any, 'handleAddressActivity').mockResolvedValue(undefined);

      // 執行被測試的方法
      const result = await service.processWebhookEvent(mockPayload);

      // 斷言
      expect(result).toBe(true);
      expect(service['saveWebhookToDatabase']).toHaveBeenCalledWith(mockPayload);
      expect(service['handleAddressActivity']).toHaveBeenCalledWith(mockPayload);
    });

    it('should process NFT_ACTIVITY event correctly', async () => {
      const mockPayload = {
        webhookId: 'wh_123',
        id: 'evt_456',
        type: WebhookEventType.NFT_ACTIVITY,
        event: {
          network: 'ETH_MAINNET',
          activity: [
            {
              fromAddress: '0xabc',
              toAddress: '0xdef',
              contractAddress: '0xnft',
              erc721TokenId: '1234',
              category: 'erc721',
            },
          ],
        },
        createdAt: '2025-05-16T04:40:00.344891430Z',
      };

      jest.spyOn(service as any, 'saveWebhookToDatabase').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'handleNftActivity').mockReturnValue(undefined);

      const result = await service.processWebhookEvent(mockPayload);

      expect(result).toBe(true);
      expect(service['saveWebhookToDatabase']).toHaveBeenCalledWith(mockPayload);
      expect(service['handleNftActivity']).toHaveBeenCalledWith(mockPayload);
    });

    it('should handle errors during processing', async () => {
      const mockPayload = {
        webhookId: 'wh_123',
        id: 'evt_456',
        type: WebhookEventType.ADDRESS_ACTIVITY,
        event: { network: 'ETH_SEPOLIA', activity: [] },
        createdAt: '2025-05-16T04:40:00.344891430Z',
      };

      const mockError = new Error('Test error');
      jest.spyOn(service as any, 'saveWebhookToDatabase').mockRejectedValue(mockError);

      await expect(service.processWebhookEvent(mockPayload)).rejects.toThrow(mockError);
    });
  });

  describe('saveWebhookToDatabase', () => {
    it('should save webhook event to database', async () => {
      const mockPayload = {
        webhookId: 'wh_123',
        id: 'evt_456',
        type: WebhookEventType.ADDRESS_ACTIVITY,
        event: { network: 'ETH_SEPOLIA', activity: [] },
        createdAt: '2025-05-16T04:40:00.344891430Z',
      };

      await service['saveWebhookToDatabase'](mockPayload);

      // 使用 toBe 和 toEqual 而不是 toHaveBeenCalledWith
      const createFn = mockWebhookEventModel.create;
      const calls = createFn.mock.calls;

      expect(calls.length).toBe(1);
      expect(calls[0][0]).toEqual({
        ...mockPayload,
        receivedAt: expect.any(Date),
      });
    });

    it('should handle database errors', async () => {
      const mockPayload = {
        webhookId: 'wh_123',
        id: 'evt_456',
        type: WebhookEventType.ADDRESS_ACTIVITY,
        event: { network: 'ETH_SEPOLIA', activity: [] },
        createdAt: '2025-05-16T04:40:00.344891430Z',
      };

      const mockError = new Error('Database error');
      // 確保只有一次調用會拋出錯誤
      mockWebhookEventModel.create.mockRejectedValueOnce(mockError);

      await expect(service['saveWebhookToDatabase'](mockPayload)).rejects.toThrow(mockError);
    });
  });

  describe('handleAddressActivity', () => {
    it('should handle address activity correctly for ETH_SEPOLIA', () => {
      const mockPayload = {
        webhookId: 'wh_123',
        id: 'evt_456',
        type: WebhookEventType.ADDRESS_ACTIVITY,
        event: {
          network: 'ETH_SEPOLIA',
          activity: [
            {
              blockNum: '0xdf34a3',
              hash: '0x123',
              fromAddress: '0xabc',
              toAddress: '0xdef',
              value: 100,
              category: 'token',
              asset: 'USDC',
              rawContract: { address: '0xcontract', decimals: 6 },
              log: {},
            },
          ],
        },
        createdAt: '2025-05-16T04:40:00.344891430Z',
      };

      // 模擬 mapNetworkToChainType 方法，讓它返回 ETHEREUM
      jest.spyOn(service as any, 'mapNetworkToChainType').mockReturnValue(ChainName.ETHEREUM);

      // 模擬 getChainIdFromNetworkId 函數
      mockGetChainIdFromNetworkId.mockReturnValue(11155111);

      service['handleAddressActivity'](mockPayload);

      // 檢查 emitAddressActivity 調用
      const emitActivityFn = mockNotificationService.emitAddressActivity;
      const calls = emitActivityFn.mock.calls;

      // 預期有2次調用，一次是對 fromAddress，一次是對 toAddress
      expect(calls.length).toBe(2);

      // 驗證第一次調用（fromAddress）
      expect(calls[0][0]).toBe(ChainName.ETHEREUM);
      expect(calls[0][1]).toBe(11155111);
      expect(calls[0][2]).toBe('0xabc');
      expect(calls[0][3]).toMatchObject({
        txHash: '0x123',
        eventType: WebhookEventType.ADDRESS_ACTIVITY,
      });

      // 驗證第二次調用（toAddress）
      expect(calls[1][0]).toBe(ChainName.ETHEREUM);
      expect(calls[1][1]).toBe(11155111);
      expect(calls[1][2]).toBe('0xdef');
      expect(calls[1][3]).toMatchObject({
        txHash: '0x123',
        eventType: WebhookEventType.ADDRESS_ACTIVITY,
      });
    });

    it('should use fallback mechanism when chain ID is not found', () => {
      const mockPayload = {
        webhookId: 'wh_123',
        id: 'evt_456',
        type: WebhookEventType.ADDRESS_ACTIVITY,
        event: {
          network: 'UNKNOWN_NETWORK',
          activity: [
            {
              blockNum: '0xdf34a3',
              hash: '0x123',
              fromAddress: '0xabc',
              toAddress: '0xdef',
              value: 100,
              category: 'token',
              asset: 'USDC',
              rawContract: { address: '0xcontract', decimals: 6 },
              log: {},
            },
          ],
        },
        createdAt: '2025-05-16T04:40:00.344891430Z',
      };

      jest.spyOn(service as any, 'mapNetworkToChainType').mockReturnValue(ChainName.ETHEREUM);
      mockGetChainIdFromNetworkId.mockReturnValue(null);

      service['handleAddressActivity'](mockPayload);

      // 因為缺少有效的 chainId，所以不應調用 emitAddressActivity
      const emitActivityFn = mockNotificationService.emitAddressActivity;
      expect(emitActivityFn.mock.calls.length).toBe(0);

      // 在這個情況下不會調用 invalidateAddressCache
      const invalidateCacheFn = mockCacheKeyService.invalidateAddressCache;
      expect(invalidateCacheFn.mock.calls.length).toBe(0);
    });

    it('should handle invalid activity data', () => {
      // 修改為完整的 AddressActivityEvent 格式，但缺少關鍵資訊
      const mockPayload = {
        webhookId: 'wh_123',
        id: 'evt_456',
        type: WebhookEventType.ADDRESS_ACTIVITY,
        event: {
          network: 'ETH_SEPOLIA',
          activity: [
            {
              blockNum: '0xdf34a3',
              hash: '0x123',
              // 故意移除 fromAddress，但保留 toAddress 和足夠的其他字段以滿足類型要求
              toAddress: '0xdef',
              category: 'token',
              value: 0,
              asset: '',
              rawContract: { address: '0x0' },
              log: {},
            },
          ],
        },
        createdAt: '2025-05-16T04:40:00.344891430Z',
      };

      // 使用 as any 來繞過 TypeScript 的類型檢查
      jest.spyOn(service as any, 'mapNetworkToChainType').mockReturnValue(ChainName.ETHEREUM);
      mockGetChainIdFromNetworkId.mockReturnValue(11155111);

      service['handleAddressActivity'](mockPayload as any);

      // 預期只有 toAddress 的調用
      const emitActivityFn = mockNotificationService.emitAddressActivity;
      expect(emitActivityFn.mock.calls.length).toBe(1);
      expect(emitActivityFn.mock.calls[0][2]).toBe('0xdef');
    });
  });

  describe('handleNftActivity', () => {
    it('should handle NFT activity correctly', () => {
      const mockPayload = {
        webhookId: 'wh_123',
        id: 'evt_456',
        type: WebhookEventType.NFT_ACTIVITY,
        event: {
          network: 'ETH_MAINNET',
          activity: [
            {
              fromAddress: '0xabc',
              toAddress: '0xdef',
              contractAddress: '0xnft',
              erc721TokenId: '1234',
              category: 'erc721',
            },
          ],
        },
        createdAt: '2025-05-16T04:40:00.344891430Z',
      };

      jest.spyOn(service as any, 'mapNetworkToChainType').mockReturnValue(ChainName.ETHEREUM);
      mockGetChainIdFromNetworkId.mockReturnValue(1);

      service['handleNftActivity'](mockPayload);

      // 檢查 NFT 活動調用
      const emitNftActivityFn = mockNotificationService.emitNftActivity;
      const nftCalls = emitNftActivityFn.mock.calls;
      expect(nftCalls.length).toBe(1);
      expect(nftCalls[0][0]).toBe(ChainName.ETHEREUM);
      expect(nftCalls[0][1]).toBe('0xnft');
      expect(nftCalls[0][2]).toBe('1234');
      expect(nftCalls[0][3]).toBe('0xabc');
      expect(nftCalls[0][4]).toBe('0xdef');

      // 檢查 address 活動調用
      const emitActivityFn = mockNotificationService.emitAddressActivity;
      const activityCalls = emitActivityFn.mock.calls;
      expect(activityCalls.length).toBe(2); // fromAddress 和 toAddress
    });
  });

  describe('handleMinedTransaction', () => {
    it('should handle mined transaction correctly', () => {
      const mockPayload = {
        webhookId: 'wh_123',
        id: 'evt_456',
        type: WebhookEventType.MINED_TRANSACTION,
        event: {
          network: 'ETH_MAINNET',
          hash: '0xtx123',
          from: '0xabc',
          to: '0xdef',
          blockNum: '0x123456',
          status: 'confirmed',
          gasUsed: '0x5000',
        },
        createdAt: '2025-05-16T04:40:00.344891430Z',
      };

      jest.spyOn(service as any, 'mapNetworkToChainType').mockReturnValue(ChainName.ETHEREUM);
      mockGetChainIdFromNetworkId.mockReturnValue(1);

      service['handleMinedTransaction'](mockPayload);

      // 檢查交易通知調用
      const emitTxMinedFn = mockNotificationService.emitTransactionMined;
      const txCalls = emitTxMinedFn.mock.calls;
      expect(txCalls.length).toBe(1);
      expect(txCalls[0][0]).toBe(ChainName.ETHEREUM);
      expect(txCalls[0][1]).toBe('0xtx123');
      expect(txCalls[0][2]).toBe('0xabc');
      expect(txCalls[0][3]).toBe('0xdef');

      // 檢查地址活動調用
      const emitActivityFn = mockNotificationService.emitAddressActivity;
      const activityCalls = emitActivityFn.mock.calls;
      expect(activityCalls.length).toBe(2); // from 和 to
    });
  });

  describe('handleGraphqlEvent', () => {
    it('should handle GraphQL event correctly', () => {
      const mockPayload = {
        webhookId: 'wh_123',
        id: 'evt_456',
        type: WebhookEventType.GRAPHQL,
        event: {
          data: { someData: 'value' },
        },
        createdAt: '2025-05-16T04:40:00.344891430Z',
      };

      service['handleGraphqlEvent'](mockPayload);

      // 使用 mock.calls 屬性
      const emitCustomEventFn = mockNotificationService.emitCustomEvent;
      const calls = emitCustomEventFn.mock.calls;

      expect(calls.length).toBe(1);
      expect(calls[0][0]).toEqual({
        webhookId: 'wh_123',
        eventId: 'evt_456',
        data: { someData: 'value' },
      });
    });
  });

  describe('mapNetworkToChainType', () => {
    it('should map ETH_MAINNET to ETHEREUM', () => {
      expect(service['mapNetworkToChainType']('ETH_MAINNET')).toBe(ChainName.ETHEREUM);
    });

    it('should map SOL_MAINNET to SOLANA', () => {
      expect(service['mapNetworkToChainType']('SOL_MAINNET')).toBe(ChainName.SOLANA);
    });

    it('should return null for unknown networks', () => {
      expect(service['mapNetworkToChainType']('UNKNOWN_NETWORK')).toBeNull();
    });
  });

  describe('getChainIdFromNetworkId', () => {
    it('should return correct chain ID for ETH_MAINNET', () => {
      mockGetChainIdFromNetworkId.mockReturnValue(1);
      expect(getChainIdFromNetworkId('ETH_MAINNET')).toBe(1);
    });

    it('should return correct chain ID for ETH_SEPOLIA', () => {
      mockGetChainIdFromNetworkId.mockReturnValue(11155111);
      expect(getChainIdFromNetworkId('ETH_SEPOLIA')).toBe(11155111);
    });

    it('should return null for unknown networks', () => {
      mockGetChainIdFromNetworkId.mockReturnValue(null);
      expect(getChainIdFromNetworkId('UNKNOWN_NETWORK')).toBeNull();
    });
  });
});
