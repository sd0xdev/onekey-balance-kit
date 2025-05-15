import { Module } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { CacheModule } from '../cache/cache.module';
import { ConfigsModule } from '../../config';
import { ChainsModule } from '../../chains/modules/chains.module';

@Module({
  imports: [ConfigsModule, CacheModule, ChainsModule],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
