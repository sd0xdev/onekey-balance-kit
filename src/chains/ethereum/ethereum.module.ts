import { Module } from '@nestjs/common';
import { EthereumService } from './ethereum.service';
import { ProvidersModule } from '../../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  providers: [EthereumService],
  exports: [EthereumService],
})
export class EthereumModule {}
