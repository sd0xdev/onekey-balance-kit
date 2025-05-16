import { Module } from '@nestjs/common';
import { PortfolioMongoListener } from './portfolio-mongo.listener';
import { DbModule } from '../db/db.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [DbModule, EventEmitterModule.forRoot()],
  providers: [PortfolioMongoListener],
  exports: [],
})
export class PortfolioModule {}
