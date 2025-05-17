import { Module } from '@nestjs/common';
import { PortfolioMongoListener } from './portfolio-mongo.listener';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  providers: [PortfolioMongoListener],
  exports: [],
})
export class PortfolioModule {}
