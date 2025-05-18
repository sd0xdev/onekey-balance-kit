import { EvmBalanceAdapter } from '../evm-balance.adapter';
import { Test, TestingModule } from '@nestjs/testing';

describe('EvmBalanceAdapter', () => {
  let adapter: EvmBalanceAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EvmBalanceAdapter],
    }).compile();

    adapter = module.get<EvmBalanceAdapter>(EvmBalanceAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('toBalancesResponse', () => {
    it('should adapt EVM token balances to DTO format', () => {
      const mockStrategyResponse = {
        nativeBalance: '1000000000000000000',
        tokenBalances: [
          {
            contractAddress: '0xTokenContract',
            tokenBalance: '2000000000000000000',
            tokenMetadata: {
              symbol: 'TEST',
              decimals: 18,
              name: 'Test Token',
              logo: 'https://example.com/logo.png',
            },
          },
        ],
        ownedNfts: [],
      };

      const result = adapter.toBalancesResponse(mockStrategyResponse);

      expect(result).toBeDefined();
      expect(result.nativeBalance.balance).toBe('1000000000000000000');
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].mint).toBe('0xTokenContract');
      expect(result.tokens[0].balance).toBe('2000000000000000000');
      expect(result.tokens[0].tokenMetadata?.symbol).toBe('TEST');
      expect(result.tokens[0].tokenMetadata?.name).toBe('Test Token');
    });

    it('should handle empty token list', () => {
      const mockStrategyResponse = {
        nativeBalance: '1000000000000000000',
        tokenBalances: [],
        ownedNfts: [],
      };

      const result = adapter.toBalancesResponse(mockStrategyResponse);

      expect(result).toBeDefined();
      expect(result.nativeBalance.balance).toBe('1000000000000000000');
      expect(result.tokens).toHaveLength(0);
    });

    it('should handle undefined metadata', () => {
      const mockStrategyResponse = {
        nativeBalance: '1000000000000000000',
        tokenBalances: [
          {
            contractAddress: '0xTokenContract',
            tokenBalance: '2000000000000000000',
            tokenMetadata: undefined,
          },
        ],
        ownedNfts: [],
      };

      const result = adapter.toBalancesResponse(mockStrategyResponse);

      expect(result).toBeDefined();
      expect(result.tokens[0].mint).toBe('0xTokenContract');
      expect(result.tokens[0].tokenMetadata?.symbol).toBe('UNKNOWN');
    });

    it('should process NFTs correctly', () => {
      const mockStrategyResponse = {
        nativeBalance: '1000000000000000000',
        tokenBalances: [],
        ownedNfts: [
          {
            contract: {
              address: '0xNFTContract',
              name: 'Test Collection',
            },
            tokenId: '1',
            raw: {
              metadata: {
                name: 'Test NFT',
                image: 'https://example.com/nft.png',
              },
            },
          },
        ],
      };

      const result = adapter.toBalancesResponse(mockStrategyResponse);

      expect(result).toBeDefined();
      expect(result.nfts).toHaveLength(1);
      expect(result.nfts[0].mint).toBe('0xNFTContract');
      expect(result.nfts[0].tokenId).toBe('1');
      expect(result.nfts[0].tokenMetadata?.name).toBe('Test NFT');
      expect(result.nfts[0].tokenMetadata?.image).toBe('https://example.com/nft.png');
    });
  });

  describe('toGasPrice', () => {
    it('should prioritize maxFeePerGas over gasPrice for EIP-1559', () => {
      const mockData = {
        gasPrice: '10000000000',
        maxFeePerGas: '20000000000',
      };

      const result = adapter.toGasPrice(mockData);
      expect(result).toBe('20000000000');
    });

    it('should fall back to gasPrice when maxFeePerGas is not available', () => {
      const mockData = {
        gasPrice: '10000000000',
      };

      const result = adapter.toGasPrice(mockData);
      expect(result).toBe('10000000000');
    });
  });

  describe('toEstimateGas', () => {
    it('should return the raw estimate gas value', () => {
      const rawValue = '21000';
      const result = adapter.toEstimateGas(rawValue);
      expect(result).toBe('21000');
    });
  });
});
