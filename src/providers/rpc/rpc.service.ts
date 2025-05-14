import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcProviderFactory } from './rpc-provider.factory';
import { NetworkType } from '../blockchain/blockchain-provider.interface';
import { StandardChainType } from '../blockchain/blockchain.constants';

@Injectable()
export class RpcService {
  private readonly logger = new Logger(RpcService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly rpcProviderFactory: RpcProviderFactory,
  ) {}

  /**
   * 獲取指定鏈和網絡的 RPC 端點
   */
  getRpcEndpoint(chainType: string, useTestnet = false): string {
    try {
      const networkType =
        useTestnet || this.configService.get<string>('NODE_ENV') === 'development'
          ? NetworkType.TESTNET
          : NetworkType.MAINNET;

      const provider = this.rpcProviderFactory.getProvider(chainType);
      return provider.getRpcEndpoint(networkType);
    } catch (error) {
      this.logger.error(`Failed to get RPC endpoint: ${error.message}`);
      return '';
    }
  }

  /**
   * 執行 RPC 調用
   */
  async callRpcMethod(
    chainType: string,
    method: string,
    params: any[] = [],
    useTestnet = false,
  ): Promise<any> {
    try {
      const networkType =
        useTestnet || this.configService.get<string>('NODE_ENV') === 'development'
          ? NetworkType.TESTNET
          : NetworkType.MAINNET;

      const provider = this.rpcProviderFactory.getProvider(chainType);
      return await provider.callRpcMethod(method, params, networkType);
    } catch (error) {
      this.logger.error(`RPC call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 獲取指定地址的餘額 (作為示例，使用 Solana 提供者)
   */
  async getSolanaBalance(address: string, useTestnet = false): Promise<any> {
    try {
      const networkType =
        useTestnet || this.configService.get<string>('NODE_ENV') === 'development'
          ? NetworkType.TESTNET
          : NetworkType.MAINNET;

      const provider = this.rpcProviderFactory.getProvider(StandardChainType.SOLANA);
      return await provider.getBalances(address, networkType);
    } catch (error) {
      this.logger.error(`Failed to get Solana balance: ${error.message}`);
      throw error;
    }
  }

  /**
   * 檢查 RPC 連接健康狀態
   */
  async checkHealth(chainType: string, useTestnet = false): Promise<boolean> {
    try {
      const networkType =
        useTestnet || this.configService.get<string>('NODE_ENV') === 'development'
          ? NetworkType.TESTNET
          : NetworkType.MAINNET;

      const provider = this.rpcProviderFactory.getProvider(chainType);
      return await provider.checkHealth(networkType);
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 獲取可用的鏈類型
   */
  getAvailableChains(): string[] {
    return this.rpcProviderFactory.getAvailableChainTypes();
  }
}
