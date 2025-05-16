import { Module } from '@nestjs/common';
import { BalanceController } from './balance.controller';
import { BalanceService } from './services/balance.service';
import { CacheModule } from '../core/cache/cache.module';
import { ConfigsModule } from '../config';
import { ChainsModule } from '../chains/chains.module';

@Module({
  imports: [ConfigsModule, CacheModule, ChainsModule],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalancesModule {}
