import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule, MetadataScanner, Reflector } from '@nestjs/core';
import { ChainServiceFactory } from './services/chain-service.factory';
import { BlockchainService } from './services/blockchain.service';
import { RequestContextService } from './services/request-context.service';
import { BlockchainProviderInterceptor } from './interceptors/blockchain-provider.interceptor';
import { DiscoveryService } from './services/discovery.service';

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
  ],
  providers: [
    ChainServiceFactory,
    BlockchainService,
    RequestContextService,
    DiscoveryService,
    MetadataScanner,
    Reflector,
    {
      provide: APP_INTERCEPTOR,
      useClass: BlockchainProviderInterceptor,
    },
  ],
  exports: [ChainServiceFactory, BlockchainService],
})
export class BlockchainModule {}
