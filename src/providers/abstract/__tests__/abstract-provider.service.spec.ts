import { Test, TestingModule } from '@nestjs/testing';
import { AbstractProviderService } from '../abstract-provider.service';
import { PROVIDER_METADATA } from '../../constants/provider-metadata';
import { ChainName } from '../../../chains/constants';
import {
  BlockchainProviderInterface,
  NetworkType,
  BalancesResponse,
} from '../../interfaces/blockchain-provider.interface';

// 創建一個具體的實現，繼承自 AbstractProviderService
class TestProviderService extends AbstractProviderService implements BlockchainProviderInterface {
  constructor() {
    super();
  }

  getProviderName(): string {
    return 'Test Provider';
  }

  isSupported(): boolean {
    return true;
  }

  getBaseUrl(networkType?: string): string {
    return 'https://test.api.com';
  }

  getApiKey(networkType?: string): string {
    return 'test-api-key';
  }

  getChainConfig() {
    return {
      chainId: 1,
      name: 'Ethereum',
      nativeSymbol: 'ETH',
      nativeDecimals: 18,
    };
  }

  async getBalances(
    address: string,
    network: NetworkType,
    chain: ChainName,
  ): Promise<BalancesResponse> {
    return {
      nativeBalance: { balance: '1000000000000000000' },
      tokens: [],
      nfts: [],
    };
  }

  async getNFTs(address: string, network: NetworkType, chain: ChainName) {
    return {
      nfts: [],
    };
  }
}

describe('AbstractProviderService', () => {
  let provider: TestProviderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestProviderService],
    }).compile();

    provider = module.get<TestProviderService>(TestProviderService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getBalances', () => {
    it('should return balances for an address', async () => {
      const result = await provider.getBalances(
        '0xAddress',
        NetworkType.MAINNET,
        ChainName.ETHEREUM,
      );

      expect(result).toBeDefined();
      expect(result.nativeBalance.balance).toBe('1000000000000000000');
      expect(Array.isArray(result.tokens)).toBe(true);
      expect(Array.isArray(result.nfts)).toBe(true);
    });
  });

  describe('getNFTs', () => {
    it('should return NFTs for an address', async () => {
      const result = await provider.getNFTs('0xAddress', NetworkType.MAINNET, ChainName.ETHEREUM);

      expect(result).toBeDefined();
      expect(Array.isArray(result.nfts)).toBe(true);
    });
  });
});
