import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Chain } from '../../decorators/chain.decorator';
import { ChainName } from '../../constants/index';
import { AbstractEvmChainService } from '../core/abstract-evm-chain.service';
import { EthereumChainId } from './constants';
import { ProviderFactory } from '../../../providers/provider.factory';

/**
 * 以太坊服務實現
 */
@Injectable()
@Chain(ChainName.ETHEREUM)
export class EthereumService extends AbstractEvmChainService {
  constructor(
    protected readonly configService: ConfigService,
    providerFactory: ProviderFactory,
  ) {
    super(providerFactory);
    // 設置默認提供者，可以從配置中獲取
    const defaultProvider = this.configService.get<string>('blockchain.defaultProvider', 'alchemy');
    this.setDefaultProvider(defaultProvider);
  }

  /**
   * 返回EVM鏈類型
   */
  evmChain(): ChainName {
    return ChainName.ETHEREUM;
  }

  /**
   * 獲取測試網ChainId，覆寫父類方法
   */
  protected getTestnetChainId(): number {
    return EthereumChainId.SEPOLIA;
  }

  /**
   * 獲取鏈名稱，覆寫父類方法
   */
  getChainName(): string {
    return ChainName.ETHEREUM;
  }
}
