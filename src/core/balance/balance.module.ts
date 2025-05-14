import { Module } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
