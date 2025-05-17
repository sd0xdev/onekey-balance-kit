import { Test } from '@nestjs/testing';
import { BalanceAdapterFactory } from '../balance-adapter.factory';
import { EvmBalanceAdapter } from '../implementations/evm-balance.adapter';
import { SolanaBalanceAdapter } from '../implementations/solana-balance.adapter';
import { ChainName } from '../../../chains/constants';

describe('BalanceAdapterFactory', () => {
  // 在每個測試前重置靜態數據
  beforeEach(() => {
    // 使用反射清空 adapters Map
    const adaptersMap = (BalanceAdapterFactory as any).adapters;
    if (adaptersMap) {
      adaptersMap.clear();
    }
  });

  describe('forChain', () => {
    it('should return EVM adapter for Ethereum chain', () => {
      const adapter = BalanceAdapterFactory.forChain(ChainName.ETHEREUM);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(EvmBalanceAdapter);
    });

    it('should return EVM adapter for Polygon chain', () => {
      const adapter = BalanceAdapterFactory.forChain(ChainName.POLYGON);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(EvmBalanceAdapter);
    });

    it('should return EVM adapter for BSC chain', () => {
      const adapter = BalanceAdapterFactory.forChain(ChainName.BSC);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(EvmBalanceAdapter);
    });

    it('should return Solana adapter for Solana chain', () => {
      const adapter = BalanceAdapterFactory.forChain(ChainName.SOLANA);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(SolanaBalanceAdapter);
    });

    it('should throw error for unsupported chain', () => {
      expect(() => BalanceAdapterFactory.forChain('UNSUPPORTED_CHAIN' as ChainName)).toThrow();
    });

    it('should cache adapters and return the same instance for the same chain', () => {
      const adapter1 = BalanceAdapterFactory.forChain(ChainName.ETHEREUM);
      const adapter2 = BalanceAdapterFactory.forChain(ChainName.ETHEREUM);

      expect(adapter1).toBe(adapter2); // 應該是同一個實例
    });
  });
});
