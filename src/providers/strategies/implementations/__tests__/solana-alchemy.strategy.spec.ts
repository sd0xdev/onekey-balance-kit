import { Test, TestingModule } from '@nestjs/testing';
import { SolanaAlchemyStrategy } from '../solana-alchemy.strategy';
import { ChainName } from '../../../../chains/constants';
import { NetworkType } from '../../../../providers/interfaces/blockchain-provider.interface';

// 模擬 fetch API
global.fetch = jest.fn();

// 為測試準備的結果
const mockResults = {
  // getBalance 返回結果
  getBalance: {
    jsonrpc: '2.0',
    id: 1,
    result: { value: 1000000000 },
  },
  // getTokenAccountsByOwner 返回結果
  getTokenAccounts: {
    jsonrpc: '2.0',
    id: 1,
    result: {
      value: [
        {
          pubkey: 'TestPubkey',
          account: {
            data: {
              parsed: {
                info: {
                  mint: 'TokenMint',
                  amount: '1000000000',
                  decimals: 9,
                },
              },
            },
            executable: false,
            lamports: 1000000000,
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            rentEpoch: 0,
          },
        },
      ],
    },
  },
  // getNFTs 返回結果，使用模擬數據
  getNfts: {
    ownedNfts: [],
  },
  // getProgramAccounts 返回結果，用於元數據查詢
  getProgramAccounts: {
    jsonrpc: '2.0',
    id: 1,
    result: [],
  },
  // getRecentBlockhash 返回結果
  getRecentBlockhash: {
    jsonrpc: '2.0',
    id: 1,
    result: {
      feeCalculator: { lamportsPerSignature: 5000 },
      blockhash: 'test-blockhash',
      lastValidBlockHeight: 12345,
    },
  },
  // simulateTransaction 返回結果
  simulateTransaction: {
    jsonrpc: '2.0',
    id: 1,
    result: {
      err: null,
      logs: [],
      unitsConsumed: 5000,
    },
  },
};

describe('SolanaAlchemyStrategy', () => {
  let strategy: SolanaAlchemyStrategy;

  beforeEach(async () => {
    // 重置所有模擬
    jest.clearAllMocks();

    // 模擬所有 fetch 呼叫
    (global.fetch as jest.Mock).mockImplementation((url, options) => {
      const body = options?.body ? JSON.parse(options.body) : '';
      const method = body?.method || '';

      let result;

      // 根據方法返回不同的模擬數據
      if (method === 'getBalance') {
        result = mockResults.getBalance;
      } else if (method === 'getTokenAccountsByOwner') {
        result = mockResults.getTokenAccounts;
      } else if (method === 'getProgramAccounts') {
        result = mockResults.getProgramAccounts;
      } else if (method === 'getRecentBlockhash') {
        result = mockResults.getRecentBlockhash;
      } else if (method === 'simulateTransaction') {
        result = mockResults.simulateTransaction;
      } else if (url.includes('nft/v3')) {
        // Portfolio API 呼叫
        return Promise.resolve({
          json: () => Promise.resolve(mockResults.getNfts),
          status: 200,
        });
      }

      return Promise.resolve({
        json: () => Promise.resolve(result),
        status: 200,
      });
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: SolanaAlchemyStrategy,
          useFactory: () => new SolanaAlchemyStrategy('test-api-key'),
        },
      ],
    }).compile();

    strategy = module.get<SolanaAlchemyStrategy>(SolanaAlchemyStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('getRawBalances', () => {
    it('should return token balances for an address', async () => {
      const address = 'SolanaAddress';

      const result = await strategy.getRawBalances(address, NetworkType.MAINNET);

      expect(result).toBeDefined();
      expect(result.solBalance).toBe('1000000000');
      expect(Array.isArray(result.tokenAccounts)).toBeTruthy();
      expect(Array.isArray(result.nfts)).toBeTruthy();
    });
  });

  describe('getRawGasPrice', () => {
    it('should return gas price data', async () => {
      const result = await strategy.getRawGasPrice(NetworkType.MAINNET);

      expect(result).toBeDefined();
      expect(result.lamportsPerSignature).toBe(5000);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('getRawEstimateGas', () => {
    it('should estimate gas for a transaction', async () => {
      const txData = { message: 'test-message' };
      const result = await strategy.getRawEstimateGas(txData, NetworkType.MAINNET);

      expect(result).toBeDefined();
      expect(result.lamportsUsed).toBe(5000);
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
