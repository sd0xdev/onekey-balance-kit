import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainProviderFactory } from '../../providers/blockchain/blockchain-provider.factory';
import { NetworkType } from '../../providers/blockchain/blockchain-provider.interface';
import type { BalancesResponse } from '../../providers/blockchain/blockchain-provider.interface';
import { StandardChainType } from '../../providers/blockchain/blockchain.constants';

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);

  constructor(
    private readonly blockchainProviderFactory: BlockchainProviderFactory,
    private readonly configService: ConfigService,
  ) {}

  async getBalances(address: string, useTestnet = false): Promise<BalancesResponse> {
    try {
      const networkType =
        useTestnet || this.configService.get<string>('NODE_ENV') === 'development'
          ? NetworkType.TESTNET
          : NetworkType.MAINNET;

      this.logger.log(`Getting Solana balances for ${address} on ${networkType}`);

      const provider = this.blockchainProviderFactory.getProvider(StandardChainType.SOLANA);
      const balances = await provider.getBalances(address, networkType);

      return balances;
    } catch (error) {
      this.logger.error(`Error fetching Solana balances: ${error.message}`);
      return {
        nativeBalance: { balance: '0' },
        tokens: [],
        nfts: [],
      };
    }
  }
}
