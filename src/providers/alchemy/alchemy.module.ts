import { Module } from '@nestjs/common';
import { AlchemyService } from './alchemy.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [AlchemyService],
  exports: [AlchemyService],
})
export class AlchemyModule {}
