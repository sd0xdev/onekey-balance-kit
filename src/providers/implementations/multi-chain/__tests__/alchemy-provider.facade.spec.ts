import { Test, TestingModule } from '@nestjs/testing';
import { AlchemyProviderFacade } from '../alchemy-provider.facade';
import { BalanceStrategyFactory } from '../../../strategies/balance-strategy.factory';
import { BalanceAdapterFactory } from '../../../adapters/balance-adapter.factory';
import { ChainName } from '../../../../chains/constants';
import { NetworkType } from '../../../../providers/interfaces/blockchain-provider.interface';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../../core/cache/cache.service';
import { ProviderType } from '../../../constants/blockchain-types';

// 模擬 Strategy 和 Adapter
const mockBalanceAdapter = {
  toBalancesResponse: jest.fn().mockReturnValue({
    nativeBalance: { balance: '1000000000000000000' },
    tokens: [
      {
        mint: '0xTokenContract',
        balance: '2000000000000000000',
        tokenMetadata: {
          symbol: 'TEST',
          decimals: 18,
          name: 'Test Token',
        },
      },
    ],
    nfts: [],
  }),
  toGasPrice: jest.fn().mockReturnValue('20000000000'),
  toEstimateGas: jest.fn().mockReturnValue('21000'),
};

const mockBalanceStrategy = {
  getRawBalances: jest.fn().mockResolvedValue({
    nativeBalance: { balance: '1000000000000000000' },
    tokenBalances: [
      {
        contractAddress: '0xTokenContract',
        tokenBalance: '2000000000000000000',
        tokenMetadata: {
          symbol: 'TEST',
          decimals: 18,
          name: 'Test Token',
        },
      },
    ],
    ownedNfts: [],
  }),
  getRawGasPrice: jest.fn().mockResolvedValue({
    gasPrice: '10000000000',
    maxFeePerGas: '20000000000',
  }),
  getRawEstimateGas: jest.fn().mockResolvedValue('21000'),
};

describe('AlchemyProviderFacade', () => {
  let facade: AlchemyProviderFacade;
  let mockConfigService: Partial<ConfigService>;
  let mockStrategyFactory: Partial<BalanceStrategyFactory>;
  let mockAdapterFactory: Partial<BalanceAdapterFactory>;
  let mockCacheService: Partial<CacheService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'blockchain.alchemyApiKey') return 'test-api-key';
        if (key === 'ALCHEMY_DEFAULT_CHAIN') return ChainName.ETHEREUM;
        return undefined;
      }),
    };

    mockStrategyFactory = {
      createAlchemyStrategy: jest.fn().mockReturnValue(mockBalanceStrategy),
    };

    mockAdapterFactory = {
      forChain: jest.fn().mockReturnValue(mockBalanceAdapter),
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      reset: jest.fn(),
    };

    // 在創建測試模組之前設置 BalanceAdapterFactory.forChain 的模擬實現
    BalanceAdapterFactory.forChain = jest.fn().mockReturnValue(mockBalanceAdapter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlchemyProviderFacade,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: BalanceStrategyFactory,
          useValue: mockStrategyFactory,
        },
        {
          provide: BalanceAdapterFactory,
          useValue: mockAdapterFactory,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    facade = module.get<AlchemyProviderFacade>(AlchemyProviderFacade);

    // 初始化 supportedChains
    (facade as any).supportedChains = [ChainName.ETHEREUM, ChainName.SOLANA];

    // 設置默認鏈
    (facade as any).defaultChain = ChainName.ETHEREUM;
  });

  it('should be defined', () => {
    expect(facade).toBeDefined();
  });

  describe('getBalances', () => {
    it('should get balances for Ethereum', async () => {
      const address = '0xUserAddress';

      // 手動設置策略
      (facade as any).strategies = new Map();
      (facade as any).strategies.set(ChainName.ETHEREUM, mockBalanceStrategy);

      const result = await facade.getBalances(address, NetworkType.MAINNET, ChainName.ETHEREUM);

      expect(result).toBeDefined();
      expect(mockBalanceStrategy.getRawBalances).toHaveBeenCalledWith(address, NetworkType.MAINNET);
      expect(BalanceAdapterFactory.forChain).toHaveBeenCalledWith(ChainName.ETHEREUM);
      expect(mockBalanceAdapter.toBalancesResponse).toHaveBeenCalled();
    });

    it('should get balances for Solana', async () => {
      const address = 'SolanaAddress';

      // 手動設置策略
      (facade as any).strategies = new Map();
      (facade as any).strategies.set(ChainName.SOLANA, mockBalanceStrategy);

      const result = await facade.getBalances(address, NetworkType.MAINNET, ChainName.SOLANA);

      expect(result).toBeDefined();
      expect(mockBalanceStrategy.getRawBalances).toHaveBeenCalledWith(address, NetworkType.MAINNET);
      expect(BalanceAdapterFactory.forChain).toHaveBeenCalledWith(ChainName.SOLANA);
      expect(mockBalanceAdapter.toBalancesResponse).toHaveBeenCalled();
    });
  });

  describe('getGasPrice', () => {
    it('should get gas price', async () => {
      // 手動設置策略
      (facade as any).strategies = new Map();
      (facade as any).strategies.set(ChainName.ETHEREUM, mockBalanceStrategy);

      const result = await facade.getGasPrice(NetworkType.MAINNET, ChainName.ETHEREUM);

      expect(result).toBeDefined();
      expect(mockBalanceStrategy.getRawGasPrice).toHaveBeenCalledWith(NetworkType.MAINNET);
      expect(BalanceAdapterFactory.forChain).toHaveBeenCalledWith(ChainName.ETHEREUM);
      expect(mockBalanceAdapter.toGasPrice).toHaveBeenCalled();
    });
  });

  describe('estimateGas', () => {
    it('should estimate gas for a transaction', async () => {
      // 手動設置策略
      (facade as any).strategies = new Map();
      (facade as any).strategies.set(ChainName.ETHEREUM, mockBalanceStrategy);

      const txData = {
        from: '0xSenderAddress',
        to: '0xReceiverAddress',
        data: '0x',
        value: '0x0',
      };

      const result = await facade.estimateGas(txData, NetworkType.MAINNET, ChainName.ETHEREUM);

      expect(result).toBeDefined();
      expect(mockBalanceStrategy.getRawEstimateGas).toHaveBeenCalledWith(
        txData,
        NetworkType.MAINNET,
      );
      expect(BalanceAdapterFactory.forChain).toHaveBeenCalledWith(ChainName.ETHEREUM);
      expect(mockBalanceAdapter.toEstimateGas).toHaveBeenCalled();
    });
  });
});
