import { Controller, Get, Param, NotFoundException, Query } from '@nestjs/common';
import { ChainServiceFactory } from '../services/core/chain-service.factory';
import { CHAIN_INFO_MAP, ChainName } from '../constants';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

@ApiTags('chains')
@Controller('chains')
export class ChainsController {
  constructor(private readonly chainServiceFactory: ChainServiceFactory) {}

  @Get()
  @ApiOperation({
    summary: '獲取所有可用的區塊鏈列表',
    description: '返回系統支援的所有區塊鏈資訊，可選擇是否包含測試網絡',
  })
  @ApiQuery({
    name: 'include_testnet',
    required: false,
    type: String,
    description: '是否包含測試網絡，設置為 "true" 則包含',
    example: 'true',
  })
  @ApiOkResponse({
    description: '成功獲取區塊鏈列表',
    schema: {
      type: 'object',
      properties: {
        chains: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1 },
              name: { type: 'string', example: 'Ethereum' },
              type: { type: 'string', example: 'ethereum' },
              isTestnet: { type: 'boolean', example: false },
              mainnetRef: { type: 'string', example: 'ethereum', nullable: true },
              supportedSymbols: {
                type: 'array',
                items: { type: 'string' },
                example: ['ETH'],
              },
            },
          },
        },
      },
    },
  })
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
  @ApiOperation({
    summary: '驗證地址在指定區塊鏈上的有效性',
    description: '檢查指定的地址是否為特定區塊鏈的有效格式',
  })
  @ApiParam({
    name: 'chain',
    description: '區塊鏈名稱或代幣符號',
    example: 'ethereum',
  })
  @ApiParam({
    name: 'address',
    description: '要驗證的區塊鏈地址',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  @ApiQuery({
    name: 'network',
    required: false,
    description: '可選的網絡類型，設置為 "testnet" 使用測試網',
    example: 'testnet',
  })
  @ApiQuery({
    name: 'chainId',
    required: false,
    description: '可選的指定鏈 ID',
    example: '5',
  })
  @ApiOkResponse({
    description: '地址驗證結果',
    schema: {
      type: 'object',
      properties: {
        chain: { type: 'string', example: 'ethereum' },
        chainId: { type: 'number', example: 1 },
        address: { type: 'string', example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
        isValid: { type: 'boolean', example: true },
        isTestnet: { type: 'boolean', example: false },
      },
    },
  })
  @ApiNotFoundResponse({ description: '指定的區塊鏈不支援' })
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
  @ApiOperation({
    summary: '獲取地址在指定區塊鏈上的交易歷史',
    description: '返回指定地址在特定區塊鏈上的交易哈希列表',
  })
  @ApiParam({
    name: 'chain',
    description: '區塊鏈名稱或代幣符號',
    example: 'ethereum',
  })
  @ApiParam({
    name: 'address',
    description: '要查詢的錢包地址',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  @ApiQuery({
    name: 'network',
    required: false,
    description: '可選的網絡類型，設置為 "testnet" 使用測試網',
    example: 'testnet',
  })
  @ApiQuery({
    name: 'chainId',
    required: false,
    description: '可選的指定鏈 ID',
    example: '5',
  })
  @ApiOkResponse({
    description: '地址交易歷史',
    schema: {
      type: 'object',
      properties: {
        chain: { type: 'string', example: 'ethereum' },
        chainId: { type: 'number', example: 1 },
        address: { type: 'string', example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
        isTestnet: { type: 'boolean', example: false },
        transactions: {
          type: 'array',
          items: { type: 'string' },
          example: ['0x1234...', '0x5678...'],
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: '指定的區塊鏈不支援' })
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
