import { Controller, Get, Param, Query } from '@nestjs/common';
import { BalanceService } from '../core/balance/balance.service';

@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':chain/:address')
  getBalances(
    @Param('chain') chain: string,
    @Param('address') address: string,
    @Query('provider') provider?: string,
  ) {
    return this.balanceService.getPortfolio(chain, address, provider);
  }
}
