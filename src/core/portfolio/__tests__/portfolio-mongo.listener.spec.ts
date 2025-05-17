import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioMongoListener } from '../portfolio-mongo.listener';
import { DbService } from '../../db/db.service';
import {
  PortfolioRedisUpdatedEvent,
  NotificationEventType,
} from '../../../notification/notification.service';
import { ChainName } from '../../../chains/constants';
import { ProviderType } from '../../../providers/constants/blockchain-types';

describe('PortfolioMongoListener', () => {
  let listener: PortfolioMongoListener;
  let dbService: DbService;

  // 模擬資料
  const mockPortfolioData = {
    nativeBalance: {
      symbol: 'ETH',
      value: '1.5',
      valueUsd: '3000',
    },
    tokens: [
      {
        symbol: 'USDT',
        value: '1000',
        valueUsd: '1000',
        contractAddress: '0x0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a',
      },
    ],
  };

  // 預期轉換後的資料格式
  const expectedTransformedData = {
    native: {
      symbol: 'ETH',
      value: '1.5',
      valueUsd: '3000',
    },
    fungibles: [
      {
        symbol: 'USDT',
        value: '1000',
        valueUsd: '1000',
        contractAddress: '0x0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a',
      },
    ],
    blockNumber: 0,
  };

  // 設置測試模組
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioMongoListener,
        {
          provide: DbService,
          useValue: {
            savePortfolioSnapshot: jest
              .fn()
              .mockImplementation((chain, chainId, address, data, provider, ttlSeconds) => {
                return Promise.resolve({
                  chain,
                  chainId,
                  address,
                  ...data,
                  provider,
                });
              }),
          },
        },
      ],
    }).compile();

    listener = module.get<PortfolioMongoListener>(PortfolioMongoListener);
    dbService = module.get<DbService>(DbService);
  });

  it('應該被定義', () => {
    expect(listener).toBeDefined();
  });

  describe('transformPortfolioData', () => {
    it('應該正確轉換 nativeBalance 為 native', () => {
      // 使用 private 方法需要使用 any 類型
      const result = (listener as any).transformPortfolioData(mockPortfolioData);

      // 驗證結果
      expect(result.native).toBeDefined();
      expect(result.nativeBalance).toBeUndefined();
      expect(result.native).toEqual(mockPortfolioData.nativeBalance);
    });

    it('應該正確轉換 tokens 為 fungibles', () => {
      const result = (listener as any).transformPortfolioData(mockPortfolioData);

      expect(result.fungibles).toBeDefined();
      expect(result.tokens).toBeUndefined();
      expect(result.fungibles).toEqual(mockPortfolioData.tokens);
    });

    it('應該設置默認的 blockNumber', () => {
      const result = (listener as any).transformPortfolioData(mockPortfolioData);

      expect(result.blockNumber).toBeDefined();
      expect(result.blockNumber).toBe(0);
    });

    it('應該跳過已轉換格式的資料', () => {
      const alreadyTransformedData = {
        native: {
          symbol: 'ETH',
          value: '1.5',
        },
        fungibles: [],
        blockNumber: 100,
      };

      const result = (listener as any).transformPortfolioData(alreadyTransformedData);

      expect(result).toEqual(alreadyTransformedData);
    });
  });

  describe('handlePortfolioRedisUpdated', () => {
    it('應該將 Redis 資料同步到 MongoDB', async () => {
      // 創建事件
      const event = new PortfolioRedisUpdatedEvent(
        ChainName.ETHEREUM,
        1,
        '0x1234567890123456789012345678901234567890',
        mockPortfolioData,
        ProviderType.ALCHEMY,
        3600, // TTL 1小時
      );

      // 執行方法
      await listener.handlePortfolioRedisUpdated(event);

      // 驗證 DbService 的 savePortfolioSnapshot 方法是否被調用
      expect(dbService.savePortfolioSnapshot).toHaveBeenCalledTimes(1);
      expect(dbService.savePortfolioSnapshot).toHaveBeenCalledWith(
        ChainName.ETHEREUM,
        1,
        '0x1234567890123456789012345678901234567890',
        expect.objectContaining({
          native: mockPortfolioData.nativeBalance,
          fungibles: mockPortfolioData.tokens,
          blockNumber: 0,
        }),
        ProviderType.ALCHEMY,
        3600,
      );
    });

    it('應該處理拋出的錯誤', async () => {
      // 模擬錯誤
      jest.spyOn(dbService, 'savePortfolioSnapshot').mockRejectedValueOnce(new Error('Test error'));

      // 創建事件
      const event = new PortfolioRedisUpdatedEvent(
        ChainName.ETHEREUM,
        1,
        '0x1234567890123456789012345678901234567890',
        mockPortfolioData,
      );

      // 創建 logger 的 spy
      const loggerErrorSpy = jest.spyOn(listener['logger'], 'error');

      // 執行方法 - 不應該拋出錯誤
      await expect(listener.handlePortfolioRedisUpdated(event)).resolves.not.toThrow();

      // 驗證錯誤是否被記錄
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to sync portfolio data to MongoDB'),
        expect.any(String),
      );
    });
  });
});
