import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainProvider } from './blockchain-provider.interface';
import { BLOCKCHAIN_PROVIDER, StandardChainType } from './blockchain.constants';

@Injectable()
export class BlockchainProviderFactory {
  private readonly logger = new Logger(BlockchainProviderFactory.name);
  private providers: Map<string, BlockchainProvider> = new Map();

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(`${BLOCKCHAIN_PROVIDER}_${StandardChainType.ETHEREUM}`)
    private readonly ethereumProvider?: BlockchainProvider,
    @Optional()
    @Inject(`${BLOCKCHAIN_PROVIDER}_${StandardChainType.SOLANA}`)
    private readonly solanaProvider?: BlockchainProvider,
    // 可以在這裡繼續添加更多提供者
  ) {
    this.registerProviders();
  }

  private registerProviders(): void {
    try {
      // 註冊預設提供者
      if (this.ethereumProvider) {
        this.providers.set(StandardChainType.ETHEREUM, this.ethereumProvider);
        this.logger.log(`Registered provider for ${StandardChainType.ETHEREUM}`);
      }

      if (this.solanaProvider) {
        this.providers.set(StandardChainType.SOLANA, this.solanaProvider);
        this.logger.log(`Registered provider for ${StandardChainType.SOLANA}`);
      }

      // 可以在這裡添加更多提供者

      this.logger.log('Blockchain providers registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register blockchain providers: ${error.message}`);
      throw error;
    }
  }

  getProvider(chainType: string): BlockchainProvider {
    const provider = this.providers.get(chainType);

    if (!provider) {
      this.logger.error(`Provider for chain ${chainType} not found`);
      throw new Error(`Provider for chain ${chainType} not found`);
    }

    if (!provider.isSupported()) {
      this.logger.error(`Provider for chain ${chainType} is not supported`);
      throw new Error(`Provider for chain ${chainType} is not supported`);
    }

    return provider;
  }

  /**
   * 手動註冊自定義提供者
   * @param chainType 鏈類型
   * @param provider 提供者實例
   */
  registerProvider(chainType: string, provider: BlockchainProvider): void {
    this.providers.set(chainType, provider);
    this.logger.log(`Manually registered provider for ${chainType}`);
  }

  /**
   * 獲取所有可用的鏈類型
   */
  getAvailableChainTypes(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 檢查是否支持指定的鏈類型
   */
  isChainSupported(chainType: string): boolean {
    const provider = this.providers.get(chainType);
    return !!provider && provider.isSupported();
  }
}
