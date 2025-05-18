import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProviderFactory } from '../../../providers/provider.factory';
import { EthereumService } from './ethereum.service';
import {
  AbstractPriceService,
  PriceRequest,
} from '../../../prices/interfaces/abstract-price.service';
import { ChainName } from '../../constants';
import { EthereumChainId, ETH_SYMBOL } from './constants';
import { anyNumber } from '../../../utils/tests/matchers';

// 模擬提供者工廠
const mockProviderFactory = {
  getProvider: jest.fn(),
  getEvmProvider: jest.fn(),
};

// 模擬配置服務
const mockConfigService = {
  get: jest.fn().mockImplementation((key, defaultValue) => {
    if (key === 'blockchain.defaultProvider') {
      return 'alchemy';
    }
    return defaultValue;
  }),
};

// 模擬價格服務
class MockPriceService implements AbstractPriceService {
  async getPrices(request: PriceRequest): Promise<Map<string, number>> {
    const { chainId, tokens } = request;
    const prices = new Map<string, number>();
    // 只有在主網（chainId=1）時才提供價格，測試網返回 0 價格
    if (chainId === 1) {
      prices.set('0x0000000000000000000000000000000000000000', 3000); // ETH
      prices.set('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 1.0); // USDC (使用小寫地址)
    } else {
      prices.set('0x0000000000000000000000000000000000000000', 0); // ETH
      prices.set('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 0); // USDC
    }
    return prices;
  }
}

describe('EthereumService', () => {
  let service: EthereumService;

  beforeEach(async () => {
    mockProviderFactory.getProvider.mockReset();
    mockProviderFactory.getEvmProvider.mockReset();

    // 模擬 getEvmProvider 的默認實現
    mockProviderFactory.getEvmProvider.mockImplementation(() => ({
      isSupported: jest.fn().mockReturnValue(true),
      getProviderName: jest.fn().mockReturnValue('Mock Provider'),
      getBalances: jest.fn().mockResolvedValue({
        nativeBalance: {
          balance: '1000000000000000000', // 1 ETH
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
        },
        tokens: [],
        nfts: [],
        updatedAt: Date.now(),
      }),
      getAddressTransactionHashes: jest.fn().mockResolvedValue(['0xsample1', '0xsample2']),
      getTransactionDetails: jest.fn().mockImplementation((hash) => {
        // 模擬交易詳情
        return Promise.resolve({
          hash,
          from: '0xsender',
          to: '0xreceiver',
          value: '1000000000000000000',
        });
      }),
    }));

    // 模擬 getProvider 的默認實現
    mockProviderFactory.getProvider.mockImplementation(() => ({
      isSupported: jest.fn().mockReturnValue(true),
      getProviderName: jest.fn().mockReturnValue('Mock Provider'),
      getBalances: jest.fn().mockResolvedValue({
        nativeBalance: {
          balance: '1000000000000000000', // 1 ETH
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
        },
        tokens: [],
        nfts: [],
        updatedAt: Date.now(),
      }),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EthereumService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ProviderFactory, useValue: mockProviderFactory },
        { provide: AbstractPriceService, useClass: MockPriceService },
      ],
    }).compile();

    service = module.get<EthereumService>(EthereumService);

    // 模擬是否為測試網 - 預設為主網
    jest.spyOn(service, 'isTestnet').mockReturnValue(false);
  });

  it('應該被定義', () => {
    expect(service).toBeDefined();
  });

  describe('getChainName', () => {
    it('應該返回以太坊鏈名稱', () => {
      expect(service.getChainName()).toBe('Ethereum');
    });
  });

  describe('getChainSymbol', () => {
    it('應該返回以太坊符號', () => {
      expect(service.getChainSymbol()).toBe(ETH_SYMBOL);
    });
  });

  describe('isValidAddress', () => {
    it('應該驗證有效的以太坊地址', () => {
      expect(service.isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true);
    });

    it('應該拒絕無效的以太坊地址', () => {
      expect(service.isValidAddress('invalid-address')).toBe(false);
    });
  });

  describe('getAddressTransactionHashes', () => {
    it('應該返回地址的交易雜湊列表', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const hashes = await service.getAddressTransactionHashes(address);
      expect(hashes).toEqual(['0xsample1', '0xsample2']);
    });

    it('對於無效地址應該拋出錯誤', async () => {
      jest.spyOn(service, 'isValidAddress').mockReturnValueOnce(false);
      await expect(service.getAddressTransactionHashes('invalid-address')).rejects.toThrow();
    });
  });

  describe('getTransactionDetails', () => {
    it('應該返回交易詳情', async () => {
      const hash = '0x1234567890123456789012345678901234567890123456789012345678901234';
      const details = await service.getTransactionDetails(hash);
      expect(details).toEqual({
        hash,
        from: '0xsender',
        to: '0xreceiver',
        value: '1000000000000000000',
      });
    });

    it('對於無效的交易雜湊應該拋出錯誤', async () => {
      // 短雜湊直接被驗證拒絕
      await expect(service.getTransactionDetails('0xinvalid')).rejects.toThrow();
    });
  });

  describe('getBalances', () => {
    it('應該使用提供者獲取餘額並附加 USD 價格', async () => {
      // 確保使用主網以獲取價格
      jest.spyOn(service, 'getChainId').mockReturnValue(1);
      jest.spyOn(service, 'isTestnet').mockReturnValue(false);

      // 模擬特定的這次呼叫的結果
      mockProviderFactory.getEvmProvider.mockImplementationOnce(() => ({
        isSupported: jest.fn().mockReturnValue(true),
        getProviderName: jest.fn().mockReturnValue('Mock Provider'),
        getBalances: jest.fn().mockResolvedValueOnce({
          nativeBalance: {
            balance: '1000000000000000000', // 1 ETH
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18,
          },
          tokens: [
            {
              mint: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              tokenMetadata: {
                name: 'USD Coin',
                symbol: 'USDC',
                decimals: 6,
              },
              balance: '1000000000', // 1000 USDC
            },
          ],
          nfts: [],
          updatedAt: Date.now(),
        }),
      }));

      const address = '0x1234567890123456789012345678901234567890';
      const result = await service.getBalances(address);

      // 驗證提供者呼叫正確
      expect(mockProviderFactory.getEvmProvider).toHaveBeenCalled();

      // 驗證結果格式及價格計算
      expect(result).toMatchObject({
        chainId: EthereumChainId.MAINNET,
        nativeBalance: {
          symbol: ETH_SYMBOL,
          balance: '1000000000000000000',
          decimals: 18,
          usd: 3000, // 1 ETH * $3000 = $3000
        },
        fungibles: [
          {
            symbol: 'USDC',
            decimals: 6,
            balance: '1000000000',
            usd: 1000, // 1000 USDC * $1 = $1000
          },
        ],
        updatedAt: expect.any(Number),
      });
    });

    it('應該使用測試網絡獲取餘額', async () => {
      await service.getBalances('0x1234567890123456789012345678901234567890', 11155111);
      expect(mockProviderFactory.getEvmProvider).toHaveBeenCalledWith(11155111, 'alchemy');
    });

    it('應該使用指定的提供者類型', async () => {
      await service.getBalances(
        '0x1234567890123456789012345678901234567890',
        undefined,
        'quicknode',
      );
      expect(mockProviderFactory.getEvmProvider).toHaveBeenCalledWith(1, 'quicknode');
    });

    it('如果地址無效應該拋出錯誤', async () => {
      jest.spyOn(service, 'isValidAddress').mockReturnValueOnce(false);
      await expect(service.getBalances('invalid-address')).rejects.toThrow();
    });

    it('如果提供者不支持應該使用默認實現', async () => {
      // 模擬提供者拋出錯誤
      mockProviderFactory.getEvmProvider.mockImplementationOnce(() => {
        throw new Error('Provider not supported');
      });

      // 呼叫服務方法 - 此處會使用預設實現
      const address = '0x1234567890123456789012345678901234567890';
      await service.getBalances(address);

      // 驗證提供者呼叫
      expect(mockProviderFactory.getEvmProvider).toHaveBeenCalled();
    });

    it('如果提供者拋出錯誤應該使用默認實現', async () => {
      // 模擬提供者的 getBalances 方法拋出錯誤
      mockProviderFactory.getEvmProvider.mockImplementationOnce(() => ({
        isSupported: jest.fn().mockReturnValue(true),
        getProviderName: jest.fn().mockReturnValue('Mock Provider'),
        getBalances: jest.fn().mockRejectedValueOnce(new Error('Provider error')),
      }));

      // 呼叫服務方法
      const address = '0x1234567890123456789012345678901234567890';
      await service.getBalances(address);

      // 驗證提供者呼叫
      expect(mockProviderFactory.getEvmProvider).toHaveBeenCalled();
    });

    it('在測試網上應該返回 usd=0', async () => {
      // 設置為測試網環境 - Sepolia 測試網
      jest.spyOn(service, 'getChainId').mockReturnValue(11155111);
      jest.spyOn(service, 'isTestnet').mockReturnValue(true);

      // 使用默認的 mock 實現，不需要特別 mock 本測試的 getEvmProvider
      const address = '0x1234567890123456789012345678901234567890';
      const result = await service.getBalances(address, 11155111); // Sepolia 測試網

      // 驗證結果 - 在測試網上 usd 值應該為 0
      expect(result.nativeBalance.usd).toBe(0);
      if (result.fungibles.length > 0) {
        expect(result.fungibles[0].usd).toBe(0);
      }
    });
  });

  describe('validateAddress', () => {
    it('應該調用 isValidAddress 方法', () => {
      const spy = jest.spyOn(service, 'isValidAddress');
      service.validateAddress('0x1234567890123456789012345678901234567890');
      expect(spy).toHaveBeenCalled();
    });
  });
});
