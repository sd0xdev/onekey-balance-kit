import { Module } from '@nestjs/common';
import { BalanceController } from './balance.controller';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [CoreModule],
  controllers: [BalanceController],
})
export class BalancesModule {}
