import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainProviderFactory } from './blockchain-provider.factory';
import { BLOCKCHAIN_PROVIDER } from './blockchain.constants';
import { BlockchainProvider } from './blockchain-provider.interface';
import { AlchemyEthereumProvider } from '../alchemy/alchemy-ethereum.provider';
import { AlchemySolanaProvider } from '../alchemy/alchemy-solana.provider';

// 為每種提供者類型創建的接口
export interface BlockchainProviderRegistration {
  provide: string; // 提供者標識符
  useClass: new (...args: any[]) => BlockchainProvider; // 提供者類
}

@Module({})
export class BlockchainModule {
  // 註冊提供者並返回動態模組
  static register(providers: BlockchainProviderRegistration[] = []): DynamicModule {
    // 註冊預設提供者
    const defaultProviders: BlockchainProviderRegistration[] = [
      {
        provide: 'ethereum',
        useClass: AlchemyEthereumProvider,
      },
      {
        provide: 'solana',
        useClass: AlchemySolanaProvider,
      },
    ];

    // 合併預設提供者和自定義提供者
    const allProviders = [...defaultProviders, ...providers];

    // 創建 Provider 對象
    const dynamicProviders: Provider[] = allProviders.map((provider) => ({
      provide: `${BLOCKCHAIN_PROVIDER}_${provider.provide}`,
      useClass: provider.useClass,
    }));

    return {
      module: BlockchainModule,
      imports: [ConfigModule],
      providers: [BlockchainProviderFactory, ...dynamicProviders],
      exports: [BlockchainProviderFactory],
    };
  }

  // 靜態 forRoot 方法，使用預設配置
  static forRoot(): DynamicModule {
    return this.register();
  }
}
