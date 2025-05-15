import { Module } from '@nestjs/common';
import { BalanceController } from './balance.controller';
import { CoreModule } from '../core/core.module';
import { BlockchainModule } from '../chains/blockchain.module';

@Module({
  imports: [CoreModule, BlockchainModule],
  controllers: [BalanceController],
})
export class BalancesModule {}
