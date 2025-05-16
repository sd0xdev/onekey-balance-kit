import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ChainRouter } from '../services/core/chain-router.service';
import { UseBlockchainProvider } from '../decorators/blockchain-provider.decorator';

/**
 * 鏈ID控制器
 * 提供基於chainId的直接訪問API
 */
@Controller('v1')
export class ChainIdController {
  constructor(private readonly chainRouter: ChainRouter) {}

  /**
   * 獲取指定鏈ID和地址的餘額
   * @param chainId 鏈ID
   * @param address 地址
   */
  @Get('balances/:chainId/:address')
  @UseBlockchainProvider('alchemy') // 設置預設提供者
  async getBalances(
    @Param('chainId', ParseIntPipe) chainId: number,
    @Param('address') address: string,
  ) {
    return await this.chainRouter.dispatch(chainId, async (service) => {
      if ('getBalances' in service && typeof service.getBalances === 'function') {
        return await service.getBalances(address, chainId);
      }
      throw new Error(`鏈ID ${chainId} 不支援餘額查詢`);
    });
  }

  /**
   * 驗證指定鏈ID和地址是否有效
   * @param chainId 鏈ID
   * @param address 地址
   */
  @Get('validate/:chainId/:address')
  validateAddress(
    @Param('chainId', ParseIntPipe) chainId: number,
    @Param('address') address: string,
  ) {
    return this.chainRouter.dispatch(chainId, (service) => {
      return {
        chainId,
        chain: service.getChainName(),
        address,
        isValid: service.isValidAddress(address),
      };
    });
  }

  /**
   * 獲取指定鏈ID和地址的交易
   * @param chainId 鏈ID
   * @param address 地址
   */
  @Get('transactions/:chainId/:address')
  async getTransactions(
    @Param('chainId', ParseIntPipe) chainId: number,
    @Param('address') address: string,
  ) {
    return await this.chainRouter.dispatch(chainId, async (service) => {
      const transactions = await service.getAddressTransactionHashes(address);
      return {
        chainId,
        chain: service.getChainName(),
        address,
        transactions,
      };
    });
  }
}
