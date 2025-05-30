import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Chain } from '../../decorators/chain.decorator';
import { ChainName } from '../../constants/index';
import { PriceableEvmChainService } from '../core/priceable-evm-chain.service';
import { ProviderFactory } from '../../../providers/provider.factory';
import { AbstractPriceService } from '../../../prices/interfaces/abstract-price.service';

/**
 * 以太坊服務實現
 * 使用多參數裝飾器支援主網和測試網
 * 繼承自PriceableEvmChainService以獲取價格能力
 */
@Injectable()
@Chain(ChainName.ETHEREUM, ChainName.ETHEREUM_SEPOLIA)
export class EthereumService extends PriceableEvmChainService {
  constructor(
    protected readonly configService: ConfigService,
    providerFactory: ProviderFactory,
    priceService: AbstractPriceService,
  ) {
    super(providerFactory, configService, priceService);
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

  /**
   * 驗證地址是否有效
   * @param address 要驗證的地址
   * @returns 地址是否有效
   */
  validateAddress(address: string): boolean {
    return this.isValidAddress(address);
  }
}
