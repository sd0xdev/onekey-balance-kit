import { Module } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { CacheModule } from '../cache/cache.module';
import { ConfigsModule } from '../../config';

@Module({
  imports: [ConfigsModule, CacheModule],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
