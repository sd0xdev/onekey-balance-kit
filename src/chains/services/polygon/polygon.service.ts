import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Chain } from '../../decorators/chain.decorator';
import { ChainName } from '../../constants/index';
import { AbstractEvmChainService } from '../core/abstract-evm-chain.service';
import { ProviderFactory } from '../../../providers/provider.factory';

/**
 * Polygon鏈服務
 */
@Injectable()
@Chain(ChainName.POLYGON)
export class PolygonService extends AbstractEvmChainService {
  constructor(
    protected readonly configService: ConfigService,
    providerFactory: ProviderFactory,
  ) {
    super(providerFactory);
    // 設置默認提供者，可以從配置中獲取
    const defaultProvider = this.configService.get<string>('blockchain.polygonProvider', 'alchemy');
    this.setDefaultProvider(defaultProvider);
  }

  /**
   * 返回EVM鏈類型
   */
  evmChain(): ChainName {
    return ChainName.POLYGON;
  }

  /**
   * 獲取測試網ChainId
   */
  protected getTestnetChainId(): number {
    return 80001; // Mumbai Testnet
  }
}
