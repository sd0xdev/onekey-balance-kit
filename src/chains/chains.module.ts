import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule, MetadataScanner, Reflector } from '@nestjs/core';
import { ChainServiceFactory } from './services/core/chain-service.factory';
import { BlockchainService } from './services/core/blockchain.service';
import { RequestContextService } from './services/core/request-context.service';
import { BlockchainProviderInterceptor } from './interceptors/blockchain-provider.interceptor';
import { DiscoveryService } from './services/core/discovery.service';
import { EthereumService } from './services/ethereum/ethereum.service';
import { SolanaService } from './services/solana/solana.service';
import { ChainsController } from './controllers/chains.controller';
import { ProvidersModule } from '../providers/providers.module';

/**
 * 區塊鏈模組
 *
 * 整合區塊鏈相關的服務和攔截器
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 使配置模組全局可用
    }),
    DiscoveryModule,
    ProvidersModule, // 提供鏈服務所需的提供者
  ],
  controllers: [
    ChainsController, // 鏈服務 API 控制器
  ],
  providers: [
    // 核心服務
    ChainServiceFactory,
    BlockchainService,
    RequestContextService,
    DiscoveryService,
    MetadataScanner,
    Reflector,

    // 攔截器
    {
      provide: APP_INTERCEPTOR,
      useClass: BlockchainProviderInterceptor,
    },

    // 區塊鏈特定服務
    EthereumService,
    SolanaService,
  ],
  exports: [ChainServiceFactory, BlockchainService, EthereumService, SolanaService],
})
export class ChainsModule {}
