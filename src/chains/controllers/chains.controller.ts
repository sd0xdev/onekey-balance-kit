import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ChainServiceFactory } from '../services/chain-service.factory';
import { SUPPORTED_CHAINS } from '../constants';

@Controller('chains')
export class ChainsController {
  constructor(private readonly chainServiceFactory: ChainServiceFactory) {}

  @Get()
  getAvailableChains() {
    const availableChainNames = this.chainServiceFactory.getAvailableChains();

    // 過濾出可用的鏈資訊
    const availableChains = SUPPORTED_CHAINS.filter((chain) =>
      availableChainNames.includes(chain.type.toLowerCase()),
    ).map((chain) => ({
      id: chain.id,
      name: chain.name,
      type: chain.type,
      supportedSymbols: chain.coinSymbols,
    }));

    return {
      chains: availableChains,
    };
  }

  @Get(':chain/validate/:address')
  validateAddress(@Param('chain') chainNameOrSymbol: string, @Param('address') address: string) {
    if (!this.chainServiceFactory.isChainAvailable(chainNameOrSymbol)) {
      throw new NotFoundException(`Chain ${chainNameOrSymbol} not supported`);
    }

    const chainService = this.chainServiceFactory.getChainService(chainNameOrSymbol);
    return {
      chain: chainService.getChainName(),
      address,
      isValid: chainService.isValidAddress(address),
    };
  }

  @Get(':chain/transactions/:address')
  async getAddressTransactions(
    @Param('chain') chainNameOrSymbol: string,
    @Param('address') address: string,
  ) {
    if (!this.chainServiceFactory.isChainAvailable(chainNameOrSymbol)) {
      throw new NotFoundException(`Chain ${chainNameOrSymbol} not supported`);
    }

    const chainService = this.chainServiceFactory.getChainService(chainNameOrSymbol);
    const transactions = await chainService.getAddressTransactionHashes(address);
    return {
      chain: chainService.getChainName(),
      address,
      transactions,
    };
  }
}
