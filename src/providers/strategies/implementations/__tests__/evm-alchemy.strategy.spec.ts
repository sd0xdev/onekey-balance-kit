import { Test, TestingModule } from '@nestjs/testing';
import { EvmAlchemyStrategy } from '../evm-alchemy.strategy';
import { ConfigService } from '@nestjs/config';
import { Alchemy } from 'alchemy-sdk';
import { ChainName } from '../../../../chains/constants';
import { NetworkType } from '../../../../providers/interfaces/blockchain-provider.interface';

jest.mock('alchemy-sdk', () => {
  return {
    Alchemy: jest.fn().mockImplementation(() => ({
      core: {
        getTokenBalances: jest.fn().mockResolvedValue({
          tokenBalances: [
            {
              contractAddress: '0xTokenAddress',
              tokenBalance: '1000000000000000000',
            },
          ],
        }),
        getBalance: jest.fn().mockResolvedValue({ _hex: '0x1234', _isBigNumber: true }),
        getTokenMetadata: jest.fn().mockResolvedValue({
          symbol: 'TEST',
          decimals: 18,
          name: 'Test Token',
        }),
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: { toString: () => '10000000000' },
          maxFeePerGas: { toString: () => '20000000000' },
          maxPriorityFeePerGas: { toString: () => '2000000000' },
        }),
        estimateGas: jest.fn().mockResolvedValue({
          toString: () => '21000',
        }),
      },
      nft: {
        getNftsForOwner: jest.fn().mockResolvedValue({
          ownedNfts: [
            {
              contract: { address: '0xNftContract' },
              tokenId: '1',
              title: 'Test NFT',
              tokenType: 'ERC721',
            },
          ],
          pageKey: null,
        }),
      },
    })),
    TokenBalanceType: {
      ERC20: 'erc20',
    },
  };
});

describe('EvmAlchemyStrategy', () => {
  let strategy: EvmAlchemyStrategy;
  let alchemyMock: jest.Mocked<Alchemy>;

  beforeEach(async () => {
    // 創建一個受控的 Alchemy 模擬實例
    alchemyMock = new Alchemy() as jest.Mocked<Alchemy>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: EvmAlchemyStrategy,
          useValue: new EvmAlchemyStrategy(alchemyMock),
        },
      ],
    }).compile();

    strategy = module.get<EvmAlchemyStrategy>(EvmAlchemyStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('getRawBalances', () => {
    it('should return token balances for an address', async () => {
      const address = '0xUserAddress';
      const result = await strategy.getRawBalances(address, NetworkType.MAINNET);

      expect(result).toBeDefined();
      expect(result.nativeBalance).toBeDefined();
      expect(Array.isArray(result.tokenBalances)).toBeTruthy();
      expect(alchemyMock.core.getBalance).toHaveBeenCalledWith(address);
      expect(alchemyMock.core.getTokenBalances).toHaveBeenCalled();
    });
  });

  describe('getRawGasPrice', () => {
    it('should return gas price data', async () => {
      const result = await strategy.getRawGasPrice(NetworkType.MAINNET);

      expect(result).toBeDefined();
      expect(result.gasPrice).toBeDefined();
      expect(result.maxFeePerGas).toBeDefined();
      expect(result.maxPriorityFeePerGas).toBeDefined();
      expect(alchemyMock.core.getFeeData).toHaveBeenCalled();
    });
  });

  describe('getRawEstimateGas', () => {
    it('should estimate gas for a transaction', async () => {
      const txData = {
        from: '0xSenderAddress',
        to: '0xReceiverAddress',
        data: '0x',
        value: '0x0',
      };

      const result = await strategy.getRawEstimateGas(txData, NetworkType.MAINNET);

      expect(result).toBeDefined();
      expect(result).toBe('21000');
      expect(alchemyMock.core.estimateGas).toHaveBeenCalledWith({
        from: txData.from,
        to: txData.to,
        data: txData.data,
        value: txData.value,
      });
    });
  });
});
