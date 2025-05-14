import { Controller, Get, Param } from '@nestjs/common';
import { BalanceService } from '../core/balance/balance.service';
import { SupportedChainType } from '../chains/constants';

@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':chain/:address')
  getBalances(@Param('chain') chain: SupportedChainType, @Param('address') address: string) {
    return this.balanceService.getPortfolio(chain, address);
  }
}
