import { Module } from '@nestjs/common';
import { EthereumModule } from './ethereum/ethereum.module';
import { SolanaModule } from './solana/solana.module';

@Module({
  imports: [EthereumModule, SolanaModule],
  exports: [EthereumModule, SolanaModule],
})
export class ChainsModule {}
