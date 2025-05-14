import { Module } from '@nestjs/common';
import { SolanaService } from './solana.service';
import { ProvidersModule } from '../../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  providers: [SolanaService],
  exports: [SolanaService],
})
export class SolanaModule {}
