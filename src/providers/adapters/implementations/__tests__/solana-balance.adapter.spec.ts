import { SolanaBalanceAdapter } from '../solana-balance.adapter';
import { Test, TestingModule } from '@nestjs/testing';

describe('SolanaBalanceAdapter', () => {
  let adapter: SolanaBalanceAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SolanaBalanceAdapter],
    }).compile();

    adapter = module.get<SolanaBalanceAdapter>(SolanaBalanceAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('toBalancesResponse', () => {
    it('should adapt Solana token balances to DTO format', () => {
      const mockStrategyResponse = {
        solBalance: '100000000',
        tokenAccounts: [
          {
            mint: 'TokenMintAddress',
            amount: '200000000',
            decimals: 9,
            uiAmount: 0.2,
            symbol: 'SOL',
            name: 'Solana Token',
          },
        ],
        nfts: [],
      };

      const result = adapter.toBalancesResponse(mockStrategyResponse);

      expect(result).toBeDefined();
      expect(result.nativeBalance.balance).toBe('100000000');
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].mint).toBe('TokenMintAddress');
      expect(result.tokens[0].balance).toBe('200000000');
      expect(result.tokens[0].tokenMetadata?.symbol).toBe('SOL');
      expect(result.tokens[0].tokenMetadata?.name).toBe('Solana Token');
      expect(result.tokens[0].tokenMetadata?.decimals).toBe(9);
    });

    it('should handle empty token list', () => {
      const mockStrategyResponse = {
        solBalance: '100000000',
        tokenAccounts: [],
        nfts: [],
      };

      const result = adapter.toBalancesResponse(mockStrategyResponse);

      expect(result).toBeDefined();
      expect(result.nativeBalance.balance).toBe('100000000');
      expect(result.tokens).toHaveLength(0);
    });

    it('should handle missing optional fields', () => {
      const mockStrategyResponse = {
        solBalance: '100000000',
        tokenAccounts: [
          {
            mint: 'TokenMintAddress',
            amount: '200000000',
            decimals: 9,
            uiAmount: 0.2,
          },
        ],
        nfts: [],
      };

      const result = adapter.toBalancesResponse(mockStrategyResponse);

      expect(result).toBeDefined();
      expect(result.tokens[0].mint).toBe('TokenMintAddress');
      expect(result.tokens[0].balance).toBe('200000000');
      expect(result.tokens[0].tokenMetadata?.symbol).toBe('UNKNOWN');
      expect(result.tokens[0].tokenMetadata?.name).toBe('Unknown Token');
    });

    it('should process NFTs correctly', () => {
      const mockStrategyResponse = {
        solBalance: '100000000',
        tokenAccounts: [],
        nfts: [
          {
            mint: 'NFTMintAddress',
            name: 'Solana NFT',
            symbol: 'SNFT',
            image: 'https://example.com/nft.png',
            collectionName: 'Test Collection',
          },
        ],
      };

      const result = adapter.toBalancesResponse(mockStrategyResponse);

      expect(result).toBeDefined();
      expect(result.nfts).toHaveLength(1);
      expect(result.nfts[0].mint).toBe('NFTMintAddress');
      expect(result.nfts[0].tokenId).toBe('NFTMintAddress');
      expect(result.nfts[0].tokenMetadata?.name).toBe('Solana NFT');
      expect(result.nfts[0].tokenMetadata?.image).toBe('https://example.com/nft.png');
      expect(result.nfts[0].tokenMetadata?.collection?.name).toBe('Test Collection');
    });
  });

  describe('toGasPrice', () => {
    it('should convert lamports per signature to string', () => {
      const mockData = { lamportsPerSignature: 5000 };
      const result = adapter.toGasPrice(mockData);
      expect(result).toBe('5000');
    });
  });

  describe('toEstimateGas', () => {
    it('should convert lamports used to string', () => {
      const mockData = { lamportsUsed: 21000 };
      const result = adapter.toEstimateGas(mockData);
      expect(result).toBe('21000');
    });
  });
});
