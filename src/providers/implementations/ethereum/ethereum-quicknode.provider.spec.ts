import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EthereumQuickNodeProvider } from './ethereum-quicknode.provider';
import { NetworkType } from '../../interfaces/blockchain-provider.interface';
import { Core } from '@quicknode/sdk';
import { BalanceStrategyFactory } from '../../strategies/balance-strategy.factory';
import { BalanceAdapterFactory } from '../../adapters/balance-adapter.factory';
import { ChainName } from '../../../chains/constants';
import { ProviderType } from '../../constants/blockchain-types';
import { EvmQuickNodeStrategy } from '../../strategies/implementations/evm-quicknode.strategy';

// Mock BalanceStrategyFactory
jest.mock('../../strategies/balance-strategy.factory');

// Mock BalanceAdapterFactory
jest.mock('../../adapters/balance-adapter.factory');

// Common test addresses and constants
const TEST_WALLET_ADDRESS = '0x1234567890123456789012345678901234567890';
const TEST_INVALID_ADDRESS = 'invalid-address';
const TEST_CONTRACT_ADDRESSES = {
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  BAYC: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
  RECIPIENT: '0x0987654321098765432109876543210987654321',
};
const TEST_NFT_TOKEN_ID = '1234';

// Mock @quicknode/sdk
jest.mock('@quicknode/sdk', () => {
  return {
    Core: jest.fn().mockImplementation(() => {
      // Create mock Core client
      return {
        client: {
          getBalance: jest.fn().mockResolvedValue('1000000000000000000'), // 1 ETH
          getGasPrice: jest.fn().mockResolvedValue('0x1dcd65000'), // 8 gwei
          estimateGas: jest.fn().mockResolvedValue('0x5208'), // 21000
          call: jest
            .fn()
            .mockResolvedValue('0x00000000000000000000000000000000000000000000000005f5e100'), // Mock balanceOf
          send: jest.fn().mockImplementation((method) => {
            if (method === 'eth_maxPriorityFeePerGas') {
              return Promise.resolve('0x3b9aca00'); // 1 gwei
            } else if (method === 'eth_estimateGas') {
              return Promise.resolve('0x5208'); // 21000
            }
            return Promise.resolve(null);
          }),
        },
      };
    }),
  };
});

// Mock Mock EvmQuickNodeStrategy
const mockRawBalances = {
  nativeBalance: '1000000000000000000',
  tokens: [
    {
      contractAddress: TEST_CONTRACT_ADDRESSES.USDT,
      symbol: 'USDT',
      name: 'Tether',
      balance: '100000000',
      decimals: 6,
    },
  ],
  nfts: [
    {
      contractAddress: TEST_CONTRACT_ADDRESSES.BAYC,
      tokenId: TEST_NFT_TOKEN_ID,
      name: 'Test NFT',
      symbol: 'BAYC',
      tokenURI: 'https://example.com/nft1.png',
      standard: 'ERC721',
      metadata: {
        image: 'https://example.com/nft1.png',
        attributes: [
          { trait_type: 'Background', value: 'Blue' },
          { trait_type: 'Eyes', value: 'Lazy' },
        ],
      },
    },
  ],
};

const mockGasPrice = {
  gasPrice: '8000000000',
  maxFeePerGas: '9000000000',
  maxPriorityFeePerGas: '1000000000',
};

const mockStrategy = {
  getRawBalances: jest.fn().mockResolvedValue(mockRawBalances),
  getRawGasPrice: jest.fn().mockResolvedValue(mockGasPrice),
  getRawEstimateGas: jest.fn().mockResolvedValue('21000'),
};

// Mock adapter
const mockAdapter = {
  toBalancesResponse: jest.fn().mockImplementation((raw) => ({
    nativeBalance: { balance: raw.nativeBalance },
    tokens: raw.tokens.map((t: any) => ({
      mint: t.contractAddress,
      tokenMetadata: {
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
      },
      balance: t.balance,
    })),
    nfts: raw.nfts.map((n: any) => ({
      mint: n.contractAddress,
      tokenId: n.tokenId,
      tokenMetadata: {
        name: n.name,
        image: n.metadata?.image,
        collection: { name: n.symbol },
      },
    })),
  })),
  toGasPrice: jest.fn().mockImplementation((raw) => raw.maxFeePerGas || raw.gasPrice),
  toEstimateGas: jest.fn().mockImplementation((raw) => raw),
};

// Mock ConfigService
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
    const config: { [key: string]: string } = {
      QUICKNODE_ETH_MAINNET_URL: 'https://mainnet.quicknode.com/test-mainnet-key',
      QUICKNODE_ETH_TESTNET_URL: 'https://sepolia.quicknode.com/test-testnet-key',
    };
    return config[key] || defaultValue;
  }),
};

describe('EthereumQuickNodeProvider', () => {
  let provider: EthereumQuickNodeProvider;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup mockStrategy and mockAdapter
    (BalanceStrategyFactory.createQuickNodeStrategy as jest.Mock).mockReturnValue(mockStrategy);
    (BalanceAdapterFactory.forProvider as jest.Mock).mockReturnValue(mockAdapter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EthereumQuickNodeProvider,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    provider = module.get<EthereumQuickNodeProvider>(EthereumQuickNodeProvider);

    // Manually call onModuleInit to initialize Core clients
    await provider.onModuleInit();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('Initialization', () => {
    it('should correctly initialize QuickNode SDK clients', () => {
      expect(Core).toHaveBeenCalledWith({
        endpointUrl: 'https://mainnet.quicknode.com/test-mainnet-key',
        config: {
          addOns: {
            nftTokenV2: true,
          },
        },
      });

      expect(Core).toHaveBeenCalledWith({
        endpointUrl: 'https://sepolia.quicknode.com/test-testnet-key',
        config: {
          addOns: {
            nftTokenV2: true,
          },
        },
      });
    });

    it('should create strategy using BalanceStrategyFactory', () => {
      expect(BalanceStrategyFactory.createQuickNodeStrategy).toHaveBeenCalledWith(
        ChainName.ETHEREUM,
        'https://mainnet.quicknode.com/test-mainnet-key',
        'https://sepolia.quicknode.com/test-testnet-key',
      );
    });
  });

  describe('getProviderName', () => {
    it('should return the correct provider name', () => {
      expect(provider.getProviderName()).toBe('QuickNode');
    });
  });

  describe('isSupported', () => {
    it('should return true when strategy is initialized', () => {
      expect(provider.isSupported()).toBe(true);
    });
  });

  describe('getBaseUrl', () => {
    it('should return the correct mainnet base URL', () => {
      expect(provider.getBaseUrl(NetworkType.MAINNET)).toBe(
        'https://mainnet.quicknode.com/test-mainnet-key',
      );
    });

    it('should return the correct testnet base URL', () => {
      expect(provider.getBaseUrl(NetworkType.TESTNET)).toBe(
        'https://sepolia.quicknode.com/test-testnet-key',
      );
    });
  });

  describe('getApiKey', () => {
    it('should return an empty string since URL already contains API key', () => {
      expect(provider.getApiKey()).toBe('');
    });
  });

  describe('getBalances', () => {
    it('should call strategy and adapter to get balances', async () => {
      const result = await provider.getBalances(TEST_WALLET_ADDRESS);

      expect(mockStrategy.getRawBalances).toHaveBeenCalledWith(
        TEST_WALLET_ADDRESS,
        NetworkType.MAINNET,
      );
      expect(BalanceAdapterFactory.forProvider).toHaveBeenCalledWith(
        ChainName.ETHEREUM,
        ProviderType.QUICKNODE,
      );
      expect(mockAdapter.toBalancesResponse).toHaveBeenCalledWith(mockRawBalances);

      expect(result).toBeDefined();
      expect(result.nativeBalance.balance).toBe(mockRawBalances.nativeBalance);
    });

    it('should throw an error for invalid addresses', async () => {
      await expect(provider.getBalances(TEST_INVALID_ADDRESS)).rejects.toThrow(
        'Invalid Ethereum address',
      );
    });

    it('should throw an error when strategy is not available', async () => {
      // Simulate no strategy for testnet
      const strategies = (provider as any).strategies;
      strategies.delete(NetworkType.TESTNET);

      await expect(provider.getBalances(TEST_WALLET_ADDRESS, NetworkType.TESTNET)).rejects.toThrow(
        'No strategy available for network type: testnet',
      );
    });
  });

  describe('getGasPrice', () => {
    it('should return gas price using strategy and adapter', async () => {
      const gasPrice = await provider.getGasPrice();

      expect(mockStrategy.getRawGasPrice).toHaveBeenCalledWith(NetworkType.MAINNET);
      expect(mockAdapter.toGasPrice).toHaveBeenCalledWith(mockGasPrice);

      // Adapter returns maxFeePerGas as defined in mockAdapter
      expect(gasPrice).toBe('9000000000');
    });
  });

  describe('estimateGas', () => {
    it('should estimate gas using strategy and adapter', async () => {
      const tx = {
        from: TEST_WALLET_ADDRESS,
        to: TEST_CONTRACT_ADDRESSES.RECIPIENT,
        value: '1000000000000000000', // 1 ETH
      };

      const gasEstimate = await provider.estimateGas(tx);

      expect(mockStrategy.getRawEstimateGas).toHaveBeenCalledWith(tx, NetworkType.MAINNET);
      expect(mockAdapter.toEstimateGas).toHaveBeenCalledWith('21000');

      expect(gasEstimate).toBe('21000');
    });
  });

  describe('getErc20Balance', () => {
    it('should get ERC20 token balance', async () => {
      const result = await provider.getErc20Balance(
        TEST_WALLET_ADDRESS,
        TEST_CONTRACT_ADDRESSES.USDT,
      );

      expect(result).toBeDefined();
    });
  });

  describe('getErc721Tokens', () => {
    it('should get NFT tokens', async () => {
      const result = await provider.getErc721Tokens(TEST_WALLET_ADDRESS);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
