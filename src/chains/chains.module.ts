import { Module } from '@nestjs/common';
import { EthereumModule } from './ethereum/ethereum.module';
import { SolanaModule } from './solana/solana.module';
import { ChainsController } from './chains.controller';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [EthereumModule, SolanaModule, CoreModule],
  controllers: [ChainsController],
})
export class ChainsModule {}
