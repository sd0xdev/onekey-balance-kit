import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NetworkType,
  BlockchainProvider,
  ChainConfig,
} from '../blockchain/blockchain-provider.interface';

@Injectable()
export abstract class AlchemyBaseProvider implements BlockchainProvider {
  protected readonly logger: Logger;
  protected readonly mainnetApiKey: string | undefined;
  protected readonly testnetApiKey: string | undefined;
  protected readonly mainnetBaseUrl: string;
  protected readonly testnetBaseUrl: string;

  constructor(
    protected readonly configService: ConfigService,
    protected readonly chainName: string,
    mainnetApiKeyName: string,
    testnetApiKeyName: string,
    fallbackApiKeyName: string,
    mainnetBaseUrl: string,
    testnetBaseUrl: string,
  ) {
    this.logger = new Logger(`Alchemy${this.chainName}Provider`);

    // 獲取 API 密鑰
    this.mainnetApiKey =
      this.configService.get<string>(mainnetApiKeyName) ||
      this.configService.get<string>(fallbackApiKeyName);

    this.testnetApiKey =
      this.configService.get<string>(testnetApiKeyName) ||
      this.configService.get<string>(fallbackApiKeyName);

    this.mainnetBaseUrl = mainnetBaseUrl;
    this.testnetBaseUrl = testnetBaseUrl;

    this.logger.log(`Initialized for ${chainName} chain`);
  }

  public getBaseUrl(networkType: NetworkType = NetworkType.MAINNET): string {
    return networkType === NetworkType.MAINNET ? this.mainnetBaseUrl : this.testnetBaseUrl;
  }

  public getApiKey(networkType: NetworkType = NetworkType.MAINNET): string {
    const apiKey = networkType === NetworkType.MAINNET ? this.mainnetApiKey : this.testnetApiKey;

    if (!apiKey) {
      const networkName = networkType === NetworkType.MAINNET ? 'mainnet' : 'testnet';
      throw new Error(`${this.chainName} ${networkName} API key is not configured`);
    }

    return apiKey;
  }

  public isSupported(): boolean {
    return !!this.mainnetApiKey || !!this.testnetApiKey;
  }

  public abstract getChainConfig(): ChainConfig;
  public abstract getBalances(address: string, networkType?: NetworkType): Promise<any>;
}
