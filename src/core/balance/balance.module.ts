import { Module } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { CacheModule } from '../cache/cache.module';
import { ConfigsModule } from '../../config';
import { ProvidersModule } from '../../providers/providers.module';

@Module({
  imports: [ConfigsModule, CacheModule, ProvidersModule],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
