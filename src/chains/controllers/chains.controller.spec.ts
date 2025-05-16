import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChainsController } from './chains.controller';
import { ChainServiceFactory } from '../services/core/chain-service.factory';
import { SUPPORTED_CHAINS, ChainName } from '../constants';

// 創建模擬的ChainService類
class MockChainService {
  constructor(private readonly chainName: ChainName) {}

  getChainName() {
    return this.chainName;
  }

  isValidAddress(address: string) {
    // 模擬地址驗證邏輯，假設以'0x'開頭的為有效的以太坊地址，以'sol'開頭的為有效的Solana地址
    if (this.chainName === ChainName.ETHEREUM) {
      return address.startsWith('0x');
    } else if (this.chainName === ChainName.SOLANA) {
      return address.startsWith('sol');
    }
    return false;
  }

  getAddressTransactionHashes(address: string) {
    // 模擬獲取交易哈希邏輯
    return ['0x123456789abcdef', '0x987654321fedcba'];
  }
}

// 模擬ChainServiceFactory
const mockChainServiceFactory = {
  getAvailableChains: jest.fn(),
  isChainAvailable: jest.fn(),
  getChainService: jest.fn(),
};

describe('ChainsController', () => {
  let controller: ChainsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChainsController],
      providers: [
        {
          provide: ChainServiceFactory,
          useValue: mockChainServiceFactory,
        },
      ],
    }).compile();

    controller = module.get<ChainsController>(ChainsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAvailableChains', () => {
    it('應該返回可用的鏈列表', () => {
      // 模擬ChainServiceFactory的行為
      mockChainServiceFactory.getAvailableChains.mockReturnValue(['ethereum', 'solana']);

      const result = controller.getAvailableChains();

      expect(result).toEqual({
        chains: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            name: expect.any(String),
            type: expect.any(String),
            supportedSymbols: expect.any(Array),
          }),
        ]),
      });
      expect(mockChainServiceFactory.getAvailableChains).toHaveBeenCalled();
    });

    it('應該返回空陣列當沒有可用的鏈', () => {
      mockChainServiceFactory.getAvailableChains.mockReturnValue([]);

      const result = controller.getAvailableChains();

      expect(result).toEqual({ chains: [] });
      expect(mockChainServiceFactory.getAvailableChains).toHaveBeenCalled();
    });
  });

  describe('validateAddress', () => {
    it('應該正確驗證以太坊地址', () => {
      const chainNameOrSymbol = 'eth';
      const address = '0x1234567890abcdef';

      mockChainServiceFactory.isChainAvailable.mockReturnValue(true);
      mockChainServiceFactory.getChainService.mockReturnValue(
        new MockChainService(ChainName.ETHEREUM),
      );

      const result = controller.validateAddress(chainNameOrSymbol, address);

      expect(result).toEqual({
        chain: ChainName.ETHEREUM,
        address,
        isValid: true,
      });
      expect(mockChainServiceFactory.isChainAvailable).toHaveBeenCalledWith(chainNameOrSymbol);
      expect(mockChainServiceFactory.getChainService).toHaveBeenCalledWith(chainNameOrSymbol);
    });

    it('應該正確驗證無效的以太坊地址', () => {
      const chainNameOrSymbol = 'eth';
      const address = 'invalid-address';

      mockChainServiceFactory.isChainAvailable.mockReturnValue(true);
      mockChainServiceFactory.getChainService.mockReturnValue(
        new MockChainService(ChainName.ETHEREUM),
      );

      const result = controller.validateAddress(chainNameOrSymbol, address);

      expect(result).toEqual({
        chain: ChainName.ETHEREUM,
        address,
        isValid: false,
      });
    });

    it('應該在不支持的鏈上拋出NotFoundException', () => {
      const chainNameOrSymbol = 'unsupported-chain';
      const address = '0x1234567890abcdef';

      mockChainServiceFactory.isChainAvailable.mockReturnValue(false);

      expect(() => {
        controller.validateAddress(chainNameOrSymbol, address);
      }).toThrow(NotFoundException);
      expect(mockChainServiceFactory.isChainAvailable).toHaveBeenCalledWith(chainNameOrSymbol);
    });
  });

  describe('getAddressTransactions', () => {
    it('應該返回地址的交易哈希列表', async () => {
      const chainNameOrSymbol = 'eth';
      const address = '0x1234567890abcdef';
      const mockTransactions = ['0x123456789abcdef', '0x987654321fedcba'];

      mockChainServiceFactory.isChainAvailable.mockReturnValue(true);
      const mockService = new MockChainService(ChainName.ETHEREUM);
      mockChainServiceFactory.getChainService.mockReturnValue(mockService);

      const result = await controller.getAddressTransactions(chainNameOrSymbol, address);

      expect(result).toEqual({
        chain: ChainName.ETHEREUM,
        address,
        transactions: mockTransactions,
      });
      expect(mockChainServiceFactory.isChainAvailable).toHaveBeenCalledWith(chainNameOrSymbol);
      expect(mockChainServiceFactory.getChainService).toHaveBeenCalledWith(chainNameOrSymbol);
    });

    it('應該在不支持的鏈上拋出NotFoundException', async () => {
      const chainNameOrSymbol = 'unsupported-chain';
      const address = '0x1234567890abcdef';

      mockChainServiceFactory.isChainAvailable.mockReturnValue(false);

      await expect(controller.getAddressTransactions(chainNameOrSymbol, address)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockChainServiceFactory.isChainAvailable).toHaveBeenCalledWith(chainNameOrSymbol);
    });
  });
});
