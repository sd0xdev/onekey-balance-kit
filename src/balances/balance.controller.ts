import { Controller, Get, Param } from '@nestjs/common';
import { BalanceService } from '../core/balance/balance.service';
import { UseBlockchainProvider } from '../chains/decorators/blockchain-provider.decorator';

@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':chain/:address')
  @UseBlockchainProvider('alchemy') // 設置預設提供者為 alchemy
  getBalances(@Param('chain') chain: string, @Param('address') address: string) {
    return this.balanceService.getPortfolio(chain, address);
  }
}
