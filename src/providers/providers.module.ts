import { Module } from '@nestjs/common';
import { DiscoveryModule, MetadataScanner } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ProviderFactory } from './provider.factory';
import { ProviderDiscoveryService } from './provider-discovery.service';
import { ProviderType } from './constants/blockchain-types';
import { PROVIDERS_TOKEN } from './constants/provider-registration';
import { SolanaAlchemyProvider } from './implementations/solana/solana-alchemy.provider';
import { EthereumQuickNodeProvider } from './implementations/ethereum/ethereum-quicknode.provider';
import { AlchemyMultiChainProvider } from './implementations/multi-chain/alchemy-multi-chain.provider';
import { ChainName } from '../chains/constants';

// 創建用於提供者註冊的提供者
const providersProvider = {
  provide: PROVIDERS_TOKEN,
  useValue: [
    // 多鏈 Alchemy 提供者
    {
      blockchainType: ChainName.ETHEREUM,
      providerType: ProviderType.ALCHEMY,
      providerClass: AlchemyMultiChainProvider,
    },
    {
      blockchainType: ChainName.ETHEREUM,
      providerType: ProviderType.QUICKNODE,
      providerClass: EthereumQuickNodeProvider,
    },
    {
      blockchainType: ChainName.SOLANA,
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
    AlchemyMultiChainProvider, // 使用新的多鏈提供者
    EthereumQuickNodeProvider,
    SolanaAlchemyProvider,
    // 通過工廠模式和依賴注入管理提供者
  ],
  exports: [ProviderFactory],
})
export class ProvidersModule {}
