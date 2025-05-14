import { Module } from '@nestjs/common';
import { DiscoveryModule, MetadataScanner, Reflector } from '@nestjs/core';
import { ChainServiceFactory } from '../services/chain-service.factory';
import { DiscoveryService } from '../services/discovery.service';
import { ChainsController } from '../controllers/chains.controller';
import { EthereumModule } from './ethereum/ethereum.module';
import { SolanaModule } from './solana/solana.module';

@Module({
  imports: [DiscoveryModule, EthereumModule, SolanaModule],
  controllers: [ChainsController],
  providers: [ChainServiceFactory, DiscoveryService, MetadataScanner, Reflector],
  exports: [ChainServiceFactory],
})
export class ChainsModule {}
