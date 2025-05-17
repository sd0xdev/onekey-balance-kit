import { Controller, Get, Param } from '@nestjs/common';
import { BalanceService } from './services/balance.service';
import { UseBlockchainProvider } from '../chains/decorators/blockchain-provider.decorator';
import { ApiTags, ApiOperation, ApiParam, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('balances')
@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':chain/:address')
  @ApiOperation({
    summary: '獲取指定地址在特定鏈上的餘額',
    description: '返回指定區塊鏈地址的錢包資產組合，包括代幣餘額和 NFT 等資訊',
  })
  @ApiParam({
    name: 'chain',
    description: '區塊鏈標識符，例如：ethereum, polygon, bsc 等',
    example: 'ethereum',
  })
  @ApiParam({
    name: 'address',
    description: '要查詢的錢包地址',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  @ApiOkResponse({
    description: '成功獲取地址的資產組合',
    schema: {
      type: 'object',
      properties: {
        tokens: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              symbol: { type: 'string', example: 'ETH' },
              balance: { type: 'string', example: '1.25' },
              value: { type: 'number', example: 2000.5 },
            },
          },
        },
        totalValue: { type: 'number', example: 5000.75 },
      },
    },
  })
  @UseBlockchainProvider('alchemy') // 設置預設提供者為 alchemy
  getBalances(@Param('chain') chain: string, @Param('address') address: string) {
    return this.balanceService.getPortfolio(chain, address);
  }
}
