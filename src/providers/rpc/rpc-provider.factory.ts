import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcProvider } from './rpc-provider.interface';
import { StandardChainType } from '../blockchain/blockchain.constants';
import { SolanaRpcProvider } from './solana-rpc.provider';

@Injectable()
export class RpcProviderFactory {
  private readonly logger = new Logger(RpcProviderFactory.name);
  private providers: Map<string, RpcProvider> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.registerProviders();
  }

  private registerProviders(): void {
    try {
      // 註冊 Solana RPC 提供者
      const solanaProvider = new SolanaRpcProvider(this.configService);
      this.providers.set(StandardChainType.SOLANA, solanaProvider);
      this.logger.log(`Registered RPC provider for ${StandardChainType.SOLANA}`);

      // 可以在這裡註冊更多提供者

      this.logger.log('RPC providers registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register RPC providers: ${error.message}`);
    }
  }

  getProvider(chainType: string): RpcProvider {
    const provider = this.providers.get(chainType);

    if (!provider) {
      this.logger.error(`RPC provider for chain ${chainType} not found`);
      throw new Error(`RPC provider for chain ${chainType} not found`);
    }

    if (!provider.isSupported()) {
      this.logger.error(`RPC provider for chain ${chainType} is not supported`);
      throw new Error(`RPC provider for chain ${chainType} is not supported`);
    }

    return provider;
  }

  registerProvider(chainType: string, provider: RpcProvider): void {
    this.providers.set(chainType, provider);
    this.logger.log(`Manually registered RPC provider for ${chainType}`);
  }

  getAvailableChainTypes(): string[] {
    return Array.from(this.providers.keys());
  }

  isChainSupported(chainType: string): boolean {
    const provider = this.providers.get(chainType);
    return !!provider && provider.isSupported();
  }
}
