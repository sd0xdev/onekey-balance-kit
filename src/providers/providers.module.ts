import { Module } from '@nestjs/common';
import { DiscoveryModule, MetadataScanner } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ProviderFactory } from './provider.factory';
import { ProviderDiscoveryService } from './provider-discovery.service';
import { BlockchainType, ProviderType } from './constants/blockchain-types';
import { PROVIDERS_TOKEN } from './constants/provider-registration';
import { EthereumAlchemyProvider } from './implementations/ethereum/ethereum-alchemy.provider';
import { SolanaAlchemyProvider } from './implementations/solana/solana-alchemy.provider';

// 創建用於提供者註冊的提供者
const providersProvider = {
  provide: PROVIDERS_TOKEN,
  useValue: [
    {
      blockchainType: BlockchainType.ETHEREUM,
      providerType: ProviderType.ALCHEMY,
      providerClass: EthereumAlchemyProvider,
    },
    {
      blockchainType: BlockchainType.SOLANA,
      providerType: ProviderType.ALCHEMY,
      providerClass: SolanaAlchemyProvider,
    },
    // 這裡可以添加更多提供者
  ],
};

@Module({
  imports: [DiscoveryModule, ConfigModule, HttpModule],
  providers: [
    MetadataScanner,
    providersProvider,
    ProviderFactory,
    ProviderDiscoveryService,
    EthereumAlchemyProvider,
    SolanaAlchemyProvider,
    // 通過工廠模式和依賴注入管理提供者
  ],
  exports: [ProviderFactory],
})
export class ProvidersModule {}
