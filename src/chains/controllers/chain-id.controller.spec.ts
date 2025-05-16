import { Test, TestingModule } from '@nestjs/testing';
import { ChainIdController } from './chain-id.controller';
import { ChainRouter } from '../services/core/chain-router.service';
import { ChainService, BalanceResponse } from '../interfaces/chain-service.interface';

describe('ChainIdController', () => {
  let controller: ChainIdController;
  let chainRouter: ChainRouter;

  // 模擬數據
  const mockBalances: BalanceResponse = [
    { symbol: 'ETH', balance: '1.5', tokenAddress: null },
    { symbol: 'USDT', balance: '100', tokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
  ];

  // 模擬鏈服務
  const mockChainService: ChainService = {
    isValidAddress: jest.fn().mockReturnValue(true),
    getAddressTransactionHashes: jest.fn().mockResolvedValue(['0xabc123...', '0xdef456...']),
    getTransactionDetails: jest.fn().mockResolvedValue({}),
    getChainName: jest.fn().mockReturnValue('Ethereum'),
    getChainSymbol: jest.fn().mockReturnValue('ETH'),
    getBalances: jest.fn().mockResolvedValue(mockBalances),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChainIdController],
      providers: [
        {
          provide: ChainRouter,
          useValue: {
            dispatch: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ChainIdController>(ChainIdController);
    chainRouter = module.get<ChainRouter>(ChainRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalances', () => {
    it('應該通過鏈路由獲取餘額', async () => {
      // 模擬數據
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';

      // 設置模擬返回
      (mockChainService.getBalances as jest.Mock).mockResolvedValue(mockBalances);
      jest.spyOn(chainRouter, 'dispatch').mockImplementation(async (id, action) => {
        expect(id).toBe(chainId);
        return await action(mockChainService);
      });

      // 執行
      const result = await controller.getBalances(chainId, address);

      // 驗證
      expect(chainRouter.dispatch).toHaveBeenCalled();
      expect(mockChainService.getBalances).toHaveBeenCalledWith(address, chainId);
      expect(result).toEqual(mockBalances);
    });

    it('當服務不支持餘額查詢時應拋出錯誤', async () => {
      // 模擬數據
      const chainId = 999;
      const address = '0x1234567890123456789012345678901234567890';

      // 創建一個沒有 getBalances 方法的模擬服務
      const invalidService: ChainService = {
        isValidAddress: jest.fn(),
        getAddressTransactionHashes: jest.fn(),
        getTransactionDetails: jest.fn(),
        getChainName: jest.fn(),
        getChainSymbol: jest.fn(),
      };

      // 設置模擬返回
      jest.spyOn(chainRouter, 'dispatch').mockImplementation(async (id, action) => {
        expect(id).toBe(chainId);
        return await action(invalidService);
      });

      // 驗證
      await expect(controller.getBalances(chainId, address)).rejects.toThrow(
        `鏈ID ${chainId} 不支援餘額查詢`,
      );
      expect(chainRouter.dispatch).toHaveBeenCalled();
    });
  });

  describe('validateAddress', () => {
    it('應該通過鏈路由驗證地址有效性', () => {
      // 模擬數據
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';
      const chainName = 'Ethereum';
      const isValid = true;

      // 設置模擬返回
      (mockChainService.isValidAddress as jest.Mock).mockReturnValue(isValid);
      (mockChainService.getChainName as jest.Mock).mockReturnValue(chainName);
      jest.spyOn(chainRouter, 'dispatch').mockImplementation((id, action) => {
        expect(id).toBe(chainId);
        return action(mockChainService);
      });

      // 執行
      const result = controller.validateAddress(chainId, address);

      // 驗證
      expect(chainRouter.dispatch).toHaveBeenCalled();
      expect(mockChainService.isValidAddress).toHaveBeenCalledWith(address);
      expect(mockChainService.getChainName).toHaveBeenCalled();
      expect(result).toEqual({
        chainId,
        chain: chainName,
        address,
        isValid,
      });
    });
  });

  describe('getTransactions', () => {
    it('應該通過鏈路由獲取交易', async () => {
      // 模擬數據
      const chainId = 1;
      const address = '0x1234567890123456789012345678901234567890';
      const chainName = 'Ethereum';
      const transactions = ['0xabc123...', '0xdef456...'];

      // 設置模擬返回
      (mockChainService.getAddressTransactionHashes as jest.Mock).mockResolvedValue(transactions);
      (mockChainService.getChainName as jest.Mock).mockReturnValue(chainName);
      jest.spyOn(chainRouter, 'dispatch').mockImplementation(async (id, action) => {
        expect(id).toBe(chainId);
        return await action(mockChainService);
      });

      // 執行
      const result = await controller.getTransactions(chainId, address);

      // 驗證
      expect(chainRouter.dispatch).toHaveBeenCalled();
      expect(mockChainService.getAddressTransactionHashes).toHaveBeenCalledWith(address);
      expect(mockChainService.getChainName).toHaveBeenCalled();
      expect(result).toEqual({
        chainId,
        chain: chainName,
        address,
        transactions,
      });
    });
  });
});
