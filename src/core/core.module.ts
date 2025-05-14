import { Module } from '@nestjs/common';
import { BalanceModule } from './balance/balance.module';
import { CacheModule } from './cache/cache.module';
import { DbModule } from './db/db.module';

@Module({
  imports: [BalanceModule, CacheModule, DbModule],
  exports: [BalanceModule, CacheModule, DbModule],
})
export class CoreModule {}
