import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscoveryModule, MetadataScanner, Reflector } from '@nestjs/core';
import { ChainServiceFactory } from './services/core/chain-service.factory';
import { BlockchainService } from './services/core/blockchain.service';
import { RequestContextService } from './services/core/request-context.service';
import { BlockchainProviderInterceptor } from './interceptors/blockchain-provider.interceptor';
import { DiscoveryService } from './services/core/discovery.service';
import { EthereumService } from './services/ethereum/ethereum.service';
import { SolanaService } from './services/solana/solana.service';
import { PolygonService } from './services/polygon/polygon.service';
import { BscService } from './services/bsc/bsc.service';
import { ChainsController } from './controllers/chains.controller';
import { ChainIdController } from './controllers/chain-id.controller';
import { ChainRouter } from './services/core/chain-router.service';
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
    ChainsController, // 傳統鏈名稱API控制器
    ChainIdController, // 新增基於chainId的API控制器
  ],
  providers: [
    // 核心服務
    ChainServiceFactory,
    BlockchainService,
    RequestContextService,
    DiscoveryService,
    ChainRouter, // 新增鏈路由服務
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
    PolygonService,
    BscService,
  ],
  exports: [
    ChainServiceFactory,
    BlockchainService,
    ChainRouter, // 導出鏈路由服務
    EthereumService,
    SolanaService,
    PolygonService,
    BscService,
  ],
})
export class ChainsModule {
  constructor(private readonly configService: ConfigService) {
    // 從配置中獲取啟用的鏈
    const enabledChains = this.configService.get<string[]>('blockchain.enabledChains', ['ETH']);

    // 輸出日誌顯示已啟用的鏈
    if (enabledChains.includes('POLY')) {
      console.log('🔗 Polygon chain service enabled');
    }

    if (enabledChains.includes('BSC')) {
      console.log('🔗 BSC chain service enabled');
    }
  }

  /**
   * 動態註冊模塊
   */
  static register(options: { enabledChains?: string[] } = {}) {
    return {
      module: ChainsModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        DiscoveryModule,
        ProvidersModule,
      ],
      controllers: [
        ChainsController,
        ChainIdController, // 註冊新控制器
      ],
      providers: [
        // 提供配置選項
        {
          provide: 'ENABLED_CHAINS_OPTIONS',
          useValue: options.enabledChains || [],
        },
        // 核心服務
        ChainServiceFactory,
        BlockchainService,
        RequestContextService,
        DiscoveryService,
        ChainRouter, // 註冊鏈路由服務
        MetadataScanner,
        Reflector,

        // 攔截器
        {
          provide: APP_INTERCEPTOR,
          useClass: BlockchainProviderInterceptor,
        },

        // 區塊鏈特定服務 - 以太坊和Solana始終啟用
        EthereumService,
        SolanaService,
        PolygonService,
        BscService,
      ],
      exports: [
        ChainServiceFactory,
        BlockchainService,
        ChainRouter, // 導出鏈路由服務
        EthereumService,
        SolanaService,
        PolygonService,
        BscService,
      ],
    };
  }
}
