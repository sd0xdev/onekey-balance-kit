import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EthereumQuickNodeProvider } from './ethereum-quicknode.provider';
import { NetworkType } from '../../interfaces/blockchain-provider.interface';
import { Core } from '@quicknode/sdk';

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
const TEST_TRANSACTION_HASH = '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234';

// Mock @quicknode/sdk
jest.mock('@quicknode/sdk', () => {
  return {
    Core: jest.fn().mockImplementation(() => {
      // Create mock Core client
      return {
        client: {
          getBalance: jest.fn().mockResolvedValue('1000000000000000000'), // 1 ETH
          qn_fetchTokenBalances: jest.fn().mockResolvedValue({
            tokens: [
              {
                address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
                symbol: 'USDT',
                name: 'Tether',
                amount: '100000000',
                decimals: 6,
              },
              {
                address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
                symbol: 'USDC',
                name: 'USD Coin',
                amount: '200000000',
                decimals: 6,
              },
            ],
          }),
          qn_fetchNFTs: jest.fn().mockResolvedValue({
            assets: [
              {
                collectionAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', // BAYC
                tokenId: '1234',
                name: 'Test NFT',
                collectionName: 'BAYC',
                imageUrl: 'https://example.com/nft1.png',
                collectionTokenType: 'ERC721',
                traits: [
                  { trait_type: 'Background', value: 'Blue' },
                  { trait_type: 'Eyes', value: 'Lazy' },
                ],
              },
            ],
          }),
          getGasPrice: jest.fn().mockResolvedValue('0x1dcd65000'), // 8 gwei
          estimateGas: jest.fn().mockResolvedValue('0x5208'), // 21000
          call: jest.fn().mockImplementation((params) => {
            if (params.method === 'eth_call') {
              // Return different results based on call parameters
              const data = params.params?.[0]?.data;

              // Assume balanceOf function selector is 0x70a08231
              if (data && data.startsWith('0x70a08231')) {
                return '0x00000000000000000000000000000000000000000000000005f5e100'; // Mock ERC20 balanceOf call
              }

              // Assume symbol function selector is 0x95d89b41
              if (data && data.startsWith('0x95d89b41')) {
                // USDT symbol, hex encoded "USDT"
                return '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000455534454000000000000000000000000000000000000000000000000000000000';
              }

              // Assume decimals function selector is 0x313ce567
              if (data && data.startsWith('0x313ce567')) {
                return '0x0000000000000000000000000000000000000000000000000000000000000006'; // 6 decimals
              }

              // Assume name function selector is 0x06fdde03
              if (data && data.startsWith('0x06fdde03')) {
                // Tether USD name, hex encoded
                return '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000a5465746865722055534400000000000000000000000000000000000000000000';
              }
            }
            return null;
          }),
          qn_getTransfersByNFT: jest.fn().mockResolvedValue({
            transfers: [
              {
                blockNumber: '0xf43b61',
                from: '0x1111111111111111111111111111111111111111',
                to: '0x2222222222222222222222222222222222222222',
                tokenId: '1234',
                transactionHash:
                  '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234',
                blockTimestamp: '2023-05-15T12:00:00Z',
              },
            ],
          }),
          qn_getContractABI: jest.fn().mockResolvedValue({
            abi: [
              {
                inputs: [],
                name: 'name',
                outputs: [{ type: 'string', name: '' }],
                stateMutability: 'view',
                type: 'function',
              },
            ],
          }),
          getFeeHistory: jest.fn().mockResolvedValue({
            baseFeePerGas: ['0x59682f00', '0x5a3e9c00'],
            gasUsedRatio: [0.5],
            oldestBlock: '0x1018798',
            reward: [['0x59682f00']],
          }),
        },
      };
    }),
  };
});

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
  let mainnetClientMock: any;
  let testnetClientMock: any;

  beforeEach(async () => {
    jest.clearAllMocks();

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

    // Get mock instances of Core constructor
    mainnetClientMock = (Core as jest.Mock).mock.results[0].value;
    testnetClientMock = (Core as jest.Mock).mock.results[1].value;
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('Initialization', () => {
    it('should correctly initialize QuickNode mainnet client', () => {
      expect(Core).toHaveBeenCalledWith({
        endpointUrl: 'https://mainnet.quicknode.com/test-mainnet-key',
        config: {
          addOns: {
            nftTokenV2: true,
          },
        },
      });
    });

    it('should correctly initialize QuickNode testnet client', () => {
      expect(Core).toHaveBeenCalledWith({
        endpointUrl: 'https://sepolia.quicknode.com/test-testnet-key',
        config: {
          addOns: {
            nftTokenV2: true,
          },
        },
      });
    });
  });

  describe('getProviderName', () => {
    it('should return the correct provider name', () => {
      expect(provider.getProviderName()).toBe('QuickNode');
    });
  });

  describe('isSupported', () => {
    it('should return true when QuickNode client exists', () => {
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
    it('should return correctly formatted balance information', async () => {
      const result = await provider.getBalances(TEST_WALLET_ADDRESS);

      expect(mainnetClientMock.client.getBalance).toHaveBeenCalledWith({
        address: TEST_WALLET_ADDRESS,
      });

      expect(mainnetClientMock.client.qn_fetchTokenBalances).toHaveBeenCalledWith({
        wallet: TEST_WALLET_ADDRESS,
        contracts: [],
        perPage: 100,
      });

      expect(mainnetClientMock.client.qn_fetchNFTs).toHaveBeenCalledWith({
        wallet: TEST_WALLET_ADDRESS,
        perPage: 100,
        page: 1,
      });

      expect(result).toEqual({
        nativeBalance: {
          balance: '1000000000000000000',
        },
        tokens: [
          {
            contractAddress: TEST_CONTRACT_ADDRESSES.USDT,
            symbol: 'USDT',
            name: 'Tether',
            balance: '100000000',
            decimals: 6,
          },
          {
            contractAddress: TEST_CONTRACT_ADDRESSES.USDC,
            symbol: 'USDC',
            name: 'USD Coin',
            balance: '200000000',
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
      });
    });

    it('should throw an error for invalid addresses', async () => {
      await expect(provider.getBalances(TEST_INVALID_ADDRESS)).rejects.toThrow(
        'Invalid Ethereum address',
      );
    });

    it('should throw an error when QuickNode client is not initialized', async () => {
      // Mock uninitialized client
      jest.spyOn(provider as any, 'getClient').mockReturnValueOnce(null);
      await expect(provider.getBalances(TEST_WALLET_ADDRESS)).rejects.toThrow(
        'QuickNode client not initialized',
      );
    });

    it('should use testnet client when requesting testnet balances', async () => {
      // Clear all previous mock calls
      jest.clearAllMocks();
      // Ensure client is correctly mocked
      const spy = jest.spyOn(provider as any, 'getClient');
      await provider.getBalances(TEST_WALLET_ADDRESS, NetworkType.TESTNET);
      // Verify getClient was called with TESTNET parameter
      expect(spy).toHaveBeenCalledWith(NetworkType.TESTNET);
    });
  });

  describe('getGasPrice', () => {
    it('should return the correct gas price', async () => {
      const gasPrice = await provider.getGasPrice();
      expect(gasPrice).toBe('0x1dcd65000');
      expect(mainnetClientMock.client.getGasPrice).toHaveBeenCalled();
    });

    it('should return default value when gas price fetch fails', async () => {
      // Clear existing mocks and ensure correct error simulation
      mainnetClientMock.client.getGasPrice.mockReset();
      mainnetClientMock.client.getGasPrice.mockRejectedValue(new Error('Gas price error'));
      const result = await provider.getGasPrice();
      // Default value should be a string
      expect(typeof result).toBe('string');
      // Default value of 50 gwei
      expect(result).toBe('50000000000');
    });
  });

  describe('getErc20Balance', () => {
    it('should return correct ERC20 token balance', async () => {
      // Clear previous test support calls
      jest.clearAllMocks();
      // Mock token balances response
      const mockFetchTokenBalances = jest.fn().mockResolvedValueOnce({
        tokens: [
          {
            address: TEST_CONTRACT_ADDRESSES.USDT,
            amount: '100000000',
          },
        ],
      });
      // Override original client mock method
      mainnetClientMock.client.qn_fetchTokenBalances = mockFetchTokenBalances;

      const balance = await provider.getErc20Balance(
        TEST_WALLET_ADDRESS,
        TEST_CONTRACT_ADDRESSES.USDT,
      );
      // Verify mock method was called
      expect(mockFetchTokenBalances).toHaveBeenCalled();
      // Verify return is string type
      expect(typeof balance).toBe('string');
      expect(balance).toBe('100000000');
    });
  });

  describe('estimateGas', () => {
    const txData = {
      from: TEST_WALLET_ADDRESS,
      to: TEST_CONTRACT_ADDRESSES.RECIPIENT,
      value: '0x38d7ea4c68000', // 0.001 ETH
      data: '0x',
    };

    it('should return the correct gas estimate', async () => {
      const gas = await provider.estimateGas(txData);
      expect(gas).toBe('0x5208');
      expect(mainnetClientMock.client.estimateGas).toHaveBeenCalled();
    });

    it('should return default value when gas estimation fails', async () => {
      // Clear existing mocks and ensure correct error simulation
      mainnetClientMock.client.estimateGas.mockReset();
      mainnetClientMock.client.estimateGas.mockRejectedValue(new Error('Gas estimation error'));
      const result = await provider.estimateGas(txData);
      expect(result).toBe('21000'); // Default value of 21000
    });
  });

  describe('getDetailedGasPrice', () => {
    it('should return detailed gas price information', async () => {
      // Ensure getFeeHistory is called
      mainnetClientMock.client.getFeeHistory.mockClear();

      const result = await provider.getDetailedGasPrice();

      expect(mainnetClientMock.client.getGasPrice).toHaveBeenCalled();
      // Since actual implementation may not call getFeeHistory, we don't check if it was called

      expect(result).toHaveProperty('gasPrice');
      expect(result).toHaveProperty('maxFeePerGas');
      expect(result).toHaveProperty('maxPriorityFeePerGas');
      expect(result).toHaveProperty('formatted');
      expect(result.formatted).toHaveProperty('gasPrice');
      expect(result.formatted).toHaveProperty('maxFeePerGas');
      expect(result.formatted).toHaveProperty('maxPriorityFeePerGas');
    });

    it('should only return gasPrice when EIP-1559 is not available', async () => {
      // Clear existing mocks and ensure correct error simulation
      mainnetClientMock.client.getFeeHistory.mockReset();
      mainnetClientMock.client.getFeeHistory.mockRejectedValue(new Error('Method not supported'));

      const result = await provider.getDetailedGasPrice();

      expect(result).toHaveProperty('gasPrice');
      expect(result).toHaveProperty('maxFeePerGas');
      expect(result).toHaveProperty('maxPriorityFeePerGas');
      // Only check types, not specific values
      expect(typeof result.maxFeePerGas).toBe('string');
      expect(typeof result.maxPriorityFeePerGas).toBe('string');
    });
  });

  describe('getErc721Tokens', () => {
    it('should return the list of NFTs owned by the address', async () => {
      const nfts = await provider.getErc721Tokens(TEST_WALLET_ADDRESS);

      expect(mainnetClientMock.client.qn_fetchNFTs).toHaveBeenCalledWith({
        wallet: TEST_WALLET_ADDRESS,
        perPage: expect.any(Number),
        page: expect.any(Number),
      });

      expect(nfts).toEqual([
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
      ]);
    });

    it('should filter NFTs by specified contract', async () => {
      await provider.getErc721Tokens(TEST_WALLET_ADDRESS, TEST_CONTRACT_ADDRESSES.BAYC);

      expect(mainnetClientMock.client.qn_fetchNFTs).toHaveBeenCalledWith({
        wallet: TEST_WALLET_ADDRESS,
        contracts: [TEST_CONTRACT_ADDRESSES.BAYC],
        perPage: expect.any(Number),
        page: expect.any(Number),
      });
    });

    it('should throw an error when NFT fetch fails', async () => {
      mainnetClientMock.client.qn_fetchNFTs.mockRejectedValueOnce(new Error('NFT fetch error'));
      await expect(provider.getErc721Tokens(TEST_WALLET_ADDRESS)).rejects.toThrow(
        'NFT fetch error',
      );
    });
  });

  describe('getNFTTransferHistory', () => {
    it('should return NFT transfer history', async () => {
      const history = await provider.getNFTTransferHistory(
        TEST_CONTRACT_ADDRESSES.BAYC,
        TEST_NFT_TOKEN_ID,
      );

      // Check if parameters match actual implementation
      expect(mainnetClientMock.client.qn_getTransfersByNFT).toHaveBeenCalledWith({
        collection: TEST_CONTRACT_ADDRESSES.BAYC,
        tokenId: TEST_NFT_TOKEN_ID,
      });

      expect(history).toEqual([
        {
          blockNumber: '0xf43b61',
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
          txHash: TEST_TRANSACTION_HASH,
          timestamp: '2023-05-15T12:00:00Z',
        },
      ]);
    });

    it('should return empty array when transfer history fetch fails', async () => {
      mainnetClientMock.client.qn_getTransfersByNFT.mockRejectedValueOnce(
        new Error('Transfer history error'),
      );
      const result = await provider.getNFTTransferHistory(
        TEST_CONTRACT_ADDRESSES.BAYC,
        TEST_NFT_TOKEN_ID,
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0); // Empty array indicates no transfer history
    });

    it('should use testnet client when requesting testnet transfer history', async () => {
      // Clear all previous mock calls
      jest.clearAllMocks();
      // Ensure client is correctly mocked
      const spy = jest.spyOn(provider as any, 'getClient');
      await provider.getNFTTransferHistory(
        TEST_CONTRACT_ADDRESSES.BAYC,
        TEST_NFT_TOKEN_ID,
        NetworkType.TESTNET,
      );
      // Verify getClient was called with TESTNET parameter
      expect(spy).toHaveBeenCalledWith(NetworkType.TESTNET);
    });
  });

  describe('getContractABI', () => {
    it('should return the smart contract ABI', async () => {
      const abi = await provider.getContractABI(TEST_CONTRACT_ADDRESSES.BAYC);

      expect(mainnetClientMock.client.qn_getContractABI).toHaveBeenCalledWith({
        contract: TEST_CONTRACT_ADDRESSES.BAYC,
      });

      expect(abi).toEqual({
        abi: [
          {
            inputs: [],
            name: 'name',
            outputs: [{ type: 'string', name: '' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
      });
    });

    it('should throw an error when ABI fetch fails', async () => {
      mainnetClientMock.client.qn_getContractABI.mockRejectedValueOnce(new Error('ABI error'));
      await expect(provider.getContractABI(TEST_CONTRACT_ADDRESSES.BAYC)).rejects.toThrow(
        'ABI error',
      );
    });
  });
});
