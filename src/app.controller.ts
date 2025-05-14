import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { BalanceService } from './core/balance/balance.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly balanceService: BalanceService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('balances/:chain/:address')
  getBalances(@Param('chain') chain: 'eth' | 'sol', @Param('address') address: string) {
    return this.balanceService.getPortfolio(chain, address);
  }
}
