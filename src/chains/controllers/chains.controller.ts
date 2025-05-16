import { Controller, Get, Param, NotFoundException, Query } from '@nestjs/common';
import { ChainServiceFactory } from '../services/core/chain-service.factory';
import { CHAIN_INFO_MAP, ChainName } from '../constants';

@Controller('chains')
export class ChainsController {
  constructor(private readonly chainServiceFactory: ChainServiceFactory) {}

  @Get()
  getAvailableChains(@Query('include_testnet') includeTestnet?: string) {
    const availableChainNames = this.chainServiceFactory.getAvailableChains();
    const showTestnets = includeTestnet === 'true';

    // 過濾出可用的鏈資訊
    const availableChains = Object.values(CHAIN_INFO_MAP)
      .filter((chain) => {
        // 如果不顯示測試網，則過濾掉非主網
        if (!showTestnets && !chain.isMainnet) {
          return false;
        }
        return availableChainNames.includes(chain.name.toLowerCase());
      })
      .map((chain) => ({
        id: chain.id,
        name: chain.display,
        type: chain.name,
        isTestnet: !chain.isMainnet,
        mainnetRef: chain.mainnetRef,
        supportedSymbols: chain.coinSymbols,
      }));

    return {
      chains: availableChains,
    };
  }

  @Get(':chain/validate/:address')
  validateAddress(
    @Param('chain') chainNameOrSymbol: string,
    @Param('address') address: string,
    @Query('network') network?: string,
    @Query('chainId') chainIdParam?: string,
  ) {
    if (!this.chainServiceFactory.isChainAvailable(chainNameOrSymbol)) {
      throw new NotFoundException(`Chain ${chainNameOrSymbol} not supported`);
    }

    // 獲取鏈服務
    const chainService = this.chainServiceFactory.getChainService(chainNameOrSymbol);

    // 處理網路參數
    let chainId: number | undefined;

    // 優先使用明確的chainId參數
    if (chainIdParam) {
      chainId = parseInt(chainIdParam, 10);
    }
    // 否則如果指定了網路類型，查找對應的chainId
    else if (network === 'testnet') {
      // 尋找該鏈對應的測試網
      for (const [name, info] of Object.entries(CHAIN_INFO_MAP)) {
        if (!info.isMainnet && info.mainnetRef?.toString() === chainNameOrSymbol) {
          chainId = info.id;
          break;
        }
      }
    }

    // 如果支援chainId且找到了chainId參數，則設置
    if (chainId && 'setChainId' in chainService) {
      (chainService as any).setChainId(chainId);
    }

    return {
      chain: chainService.getChainName(),
      chainId: 'getChainId' in chainService ? (chainService as any).getChainId() : undefined,
      address,
      isValid: chainService.isValidAddress(address),
      isTestnet: 'isTestnet' in chainService ? (chainService as any).isTestnet() : undefined,
    };
  }

  @Get(':chain/transactions/:address')
  async getAddressTransactions(
    @Param('chain') chainNameOrSymbol: string,
    @Param('address') address: string,
    @Query('network') network?: string,
    @Query('chainId') chainIdParam?: string,
  ) {
    if (!this.chainServiceFactory.isChainAvailable(chainNameOrSymbol)) {
      throw new NotFoundException(`Chain ${chainNameOrSymbol} not supported`);
    }

    // 獲取鏈服務
    const chainService = this.chainServiceFactory.getChainService(chainNameOrSymbol);

    // 處理網路參數
    let chainId: number | undefined;

    // 優先使用明確的chainId參數
    if (chainIdParam) {
      chainId = parseInt(chainIdParam, 10);
    }
    // 否則如果指定了網路類型，查找對應的chainId
    else if (network === 'testnet') {
      // 尋找該鏈對應的測試網
      for (const [name, info] of Object.entries(CHAIN_INFO_MAP)) {
        if (!info.isMainnet && info.mainnetRef?.toString() === chainNameOrSymbol) {
          chainId = info.id;
          break;
        }
      }
    }

    // 如果支援chainId且找到了chainId參數，則設置
    if (chainId && 'setChainId' in chainService) {
      (chainService as any).setChainId(chainId);
    }

    const transactions = await chainService.getAddressTransactionHashes(address);
    return {
      chain: chainService.getChainName(),
      chainId: 'getChainId' in chainService ? (chainService as any).getChainId() : undefined,
      address,
      isTestnet: 'isTestnet' in chainService ? (chainService as any).isTestnet() : undefined,
      transactions,
    };
  }
}
