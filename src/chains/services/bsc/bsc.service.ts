import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Chain } from '../../decorators/chain.decorator';
import { ChainName } from '../../constants/index';
import { AbstractEvmChainService } from '../core/abstract-evm-chain.service';
import { ProviderFactory } from '../../../providers/provider.factory';
import { EVM_CHAINS } from '../../constants/evm-chains';

/**
 * BSC(BNB Smart Chain)鏈服務
 */
@Injectable()
@Chain(ChainName.BSC)
export class BscService extends AbstractEvmChainService {
  constructor(
    protected readonly configService: ConfigService,
    providerFactory: ProviderFactory,
  ) {
    super(providerFactory);
    // 設置默認提供者，可以從配置中獲取
    const defaultProvider = this.configService.get<string>('blockchain.bscProvider', 'alchemy');
    this.setDefaultProvider(defaultProvider);
  }

  /**
   * 返回EVM鏈標識符
   */
  evmKey(): keyof typeof EVM_CHAINS {
    return 'BSC';
  }

  /**
   * 獲取測試網ChainId
   */
  protected getTestnetChainId(): number {
    return 97; // BSC Testnet
  }
}
