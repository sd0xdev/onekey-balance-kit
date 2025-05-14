import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NetworkType, ChainConfig } from '../blockchain/blockchain-provider.interface';
import { RpcProvider } from './rpc-provider.interface';
import { DEFAULT_RPC_ENDPOINTS } from './rpc-provider.constants';
import { StandardChainType } from '../blockchain/blockchain.constants';

export abstract class BaseRpcProvider implements RpcProvider {
  protected readonly logger: Logger;
  protected readonly mainnetEndpoint: string;
  protected readonly testnetEndpoint: string;
  protected readonly chainType: StandardChainType;

  constructor(
    protected readonly configService: ConfigService,
    chainType: StandardChainType,
    loggerPrefix: string,
  ) {
    this.logger = new Logger(`${loggerPrefix}RpcProvider`);
    this.chainType = chainType;

    // 從配置或默認值獲取 RPC 端點
    this.mainnetEndpoint =
      this.configService.get<string>(`RPC_ENDPOINT_${chainType}_MAINNET`) ||
      DEFAULT_RPC_ENDPOINTS[chainType]?.mainnet ||
      '';

    this.testnetEndpoint =
      this.configService.get<string>(`RPC_ENDPOINT_${chainType}_TESTNET`) ||
      DEFAULT_RPC_ENDPOINTS[chainType]?.testnet ||
      '';

    if (!this.mainnetEndpoint && !this.testnetEndpoint) {
      this.logger.warn(`No RPC endpoints configured for ${chainType}`);
    } else {
      this.logger.log(`Initialized RPC provider for ${chainType}`);
    }
  }

  public getBaseUrl(networkType: NetworkType = NetworkType.MAINNET): string {
    return this.getRpcEndpoint(networkType);
  }

  public getRpcEndpoint(networkType: NetworkType = NetworkType.MAINNET): string {
    return networkType === NetworkType.MAINNET ? this.mainnetEndpoint : this.testnetEndpoint;
  }

  public getApiKey(): string {
    // 大多數公共 RPC 端點不需要 API 密鑰
    return '';
  }

  public isSupported(): boolean {
    return !!this.mainnetEndpoint || !!this.testnetEndpoint;
  }

  public abstract getChainConfig(): ChainConfig;
  public abstract getBalances(address: string, networkType?: NetworkType): Promise<any>;

  public async checkHealth(networkType: NetworkType = NetworkType.MAINNET): Promise<boolean> {
    try {
      const endpoint = this.getRpcEndpoint(networkType);
      if (!endpoint) {
        return false;
      }

      // 簡單的健康檢查 - 使用鏈特定的方法發送請求
      const response = await this.callRpcMethod('getHealth', [], networkType);
      return response !== undefined;
    } catch (error) {
      this.logger.warn(
        `Health check failed for ${this.chainType} (${networkType}): ${error.message}`,
      );
      return false;
    }
  }

  public async callRpcMethod(
    method: string,
    params: any[] = [],
    networkType: NetworkType = NetworkType.MAINNET,
  ): Promise<any> {
    const endpoint = this.getRpcEndpoint(networkType);
    if (!endpoint) {
      throw new Error(`No RPC endpoint available for ${this.chainType} (${networkType})`);
    }

    try {
      this.logger.debug(`Calling RPC method ${method} on ${this.chainType} (${networkType})`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
      });

      if (!response.ok) {
        throw new Error(`RPC request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      return data.result;
    } catch (error) {
      this.logger.error(`RPC call failed: ${error.message}`);
      throw error;
    }
  }
}
