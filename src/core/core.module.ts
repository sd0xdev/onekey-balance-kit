import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { DbModule } from './db/db.module';

@Module({
  imports: [CacheModule, DbModule],
  exports: [CacheModule, DbModule],
})
export class CoreModule {}
