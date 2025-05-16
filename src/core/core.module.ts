import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { DbModule } from './db/db.module';
import { PortfolioModule } from './portfolio/portfolio.module';

@Module({
  imports: [CacheModule, DbModule, PortfolioModule],
  exports: [CacheModule, DbModule, PortfolioModule],
})
export class CoreModule {}
