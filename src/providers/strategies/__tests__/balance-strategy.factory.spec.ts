import { Test } from '@nestjs/testing';
import { BalanceStrategyFactory } from '../balance-strategy.factory';
import { EvmAlchemyStrategy } from '../implementations/evm-alchemy.strategy';
import { SolanaAlchemyStrategy } from '../implementations/solana-alchemy.strategy';
import { ChainName } from '../../../chains/constants';
import { ProviderType } from '../../../providers/constants/blockchain-types';
import { Alchemy, Network } from 'alchemy-sdk';

// 模擬 Alchemy SDK
jest.mock('alchemy-sdk', () => {
  return {
    Alchemy: jest.fn().mockImplementation(() => ({
      core: {
        getTokenBalances: jest.fn(),
        getBalance: jest.fn(),
      },
      nft: {
        getNftsForOwner: jest.fn(),
      },
    })),
    Network: {
      ETH_MAINNET: 'eth-mainnet',
      ETH_SEPOLIA: 'eth-sepolia',
      MATIC_MAINNET: 'polygon-mainnet',
    },
  };
});

describe('BalanceStrategyFactory', () => {
  // 在每個測試前重置靜態數據
  beforeEach(() => {
    // 使用反射清空 strategies Map
    const strategiesMap = (BalanceStrategyFactory as any).strategies;
    if (strategiesMap) {
      strategiesMap.clear();
    }
  });

  describe('createAlchemyStrategy', () => {
    it('should create EVM strategy for Ethereum chain', () => {
      const strategy = BalanceStrategyFactory.createAlchemyStrategy(
        ChainName.ETHEREUM,
        'test-api-key',
        Network.ETH_MAINNET,
      );

      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(EvmAlchemyStrategy);
      expect(Alchemy).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key',
          network: Network.ETH_MAINNET,
        }),
      );
    });

    it('should create Solana strategy for Solana chain', () => {
      const strategy = BalanceStrategyFactory.createAlchemyStrategy(
        ChainName.SOLANA,
        'test-api-key',
      );

      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(SolanaAlchemyStrategy);
    });

    it('should throw error for unsupported chain', () => {
      expect(() =>
        BalanceStrategyFactory.createAlchemyStrategy(
          'UNSUPPORTED_CHAIN' as ChainName,
          'test-api-key',
        ),
      ).toThrow();
    });

    it('should throw error for EVM chain without network', () => {
      expect(() =>
        BalanceStrategyFactory.createAlchemyStrategy(ChainName.ETHEREUM, 'test-api-key'),
      ).toThrow(/Network configuration is required/);
    });

    it('should cache strategies and return the same instance', () => {
      const strategy1 = BalanceStrategyFactory.createAlchemyStrategy(
        ChainName.ETHEREUM,
        'test-api-key',
        Network.ETH_MAINNET,
      );

      const strategy2 = BalanceStrategyFactory.createAlchemyStrategy(
        ChainName.ETHEREUM,
        'test-api-key',
        Network.ETH_MAINNET,
      );

      expect(strategy1).toBe(strategy2); // 應該是同一個實例
    });
  });

  describe('getStrategy', () => {
    it('should return undefined for non-existing strategy', () => {
      const strategy = BalanceStrategyFactory.getStrategy(ChainName.ETHEREUM, ProviderType.ALCHEMY);

      expect(strategy).toBeUndefined();
    });

    it('should return existing strategy', () => {
      // 首先創建策略
      const createdStrategy = BalanceStrategyFactory.createAlchemyStrategy(
        ChainName.ETHEREUM,
        'test-api-key',
        Network.ETH_MAINNET,
      );

      // 然後使用 getStrategy 獲取它
      const retrievedStrategy = BalanceStrategyFactory.getStrategy(
        ChainName.ETHEREUM,
        ProviderType.ALCHEMY,
      );

      expect(retrievedStrategy).toBeDefined();
      expect(retrievedStrategy).toBe(createdStrategy);
    });
  });

  describe('setStrategy', () => {
    it('should set strategy and retrieve it', () => {
      // 創建一個模擬策略
      const mockStrategy = new EvmAlchemyStrategy(new Alchemy());

      // 設置策略
      BalanceStrategyFactory.setStrategy(ChainName.ETHEREUM, ProviderType.ALCHEMY, mockStrategy);

      // 獲取它
      const retrievedStrategy = BalanceStrategyFactory.getStrategy(
        ChainName.ETHEREUM,
        ProviderType.ALCHEMY,
      );

      expect(retrievedStrategy).toBe(mockStrategy);
    });
  });

  describe('clearStrategies', () => {
    it('should clear all strategies', () => {
      // 創建策略
      BalanceStrategyFactory.createAlchemyStrategy(
        ChainName.ETHEREUM,
        'test-api-key',
        Network.ETH_MAINNET,
      );

      // 檢查是否存在
      expect(
        BalanceStrategyFactory.getStrategy(ChainName.ETHEREUM, ProviderType.ALCHEMY),
      ).toBeDefined();

      // 清除所有策略
      BalanceStrategyFactory.clearStrategies();

      // 檢查是否已清除
      expect(
        BalanceStrategyFactory.getStrategy(ChainName.ETHEREUM, ProviderType.ALCHEMY),
      ).toBeUndefined();
    });
  });
});
