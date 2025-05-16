import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Chain } from '../../decorators/chain.decorator';
import { ChainName } from '../../constants/index';
import { AbstractEvmChainService } from '../core/abstract-evm-chain.service';
import { ProviderFactory } from '../../../providers/provider.factory';

/**
 * 以太坊服務實現
 * 使用多參數裝飾器支援主網和測試網
 */
@Injectable()
@Chain(ChainName.ETHEREUM, ChainName.ETHEREUM_SEPOLIA)
export class EthereumService extends AbstractEvmChainService {
  constructor(
    protected readonly configService: ConfigService,
    providerFactory: ProviderFactory,
  ) {
    super(providerFactory, configService);
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
   * 獲取預設的鏈ID
   * 預設使用主網ID
   */
  protected getDefaultChainId(): number {
    return 1; // Ethereum Mainnet
  }
}
