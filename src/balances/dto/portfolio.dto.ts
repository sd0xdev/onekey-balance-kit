import { ApiProperty } from '@nestjs/swagger';
import { BalanceResponse } from '../../chains/interfaces/balance-queryable.interface';

/**
 * 原生代幣餘額 DTO
 */
export class NativeBalanceDto {
  @ApiProperty({
    description: '代幣符號',
    example: 'ETH',
  })
  symbol: string;

  @ApiProperty({
    description: '小數位數',
    example: 18,
  })
  decimals: number;

  @ApiProperty({
    description: '代幣餘額 (原始數值)',
    example: '1000000000000000000',
  })
  balance: string;

  @ApiProperty({
    description: '美元價值',
    example: 2000.5,
    required: false,
  })
  usd?: number;
}

/**
 * 代幣餘額 DTO
 */
export class TokenBalanceDto {
  @ApiProperty({
    description: '代幣符號',
    example: 'USDT',
  })
  symbol: string;

  @ApiProperty({
    description: '代幣名稱',
    example: 'Tether USD',
  })
  name: string;

  @ApiProperty({
    description: '代幣合約地址',
    example: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  })
  address: string;

  @ApiProperty({
    description: '代幣餘額 (原始數值)',
    example: '1000000',
  })
  balance: string;

  @ApiProperty({
    description: '小數位數',
    example: 6,
  })
  decimals: number;

  @ApiProperty({
    description: '美元價值',
    example: 1000,
    required: false,
  })
  usd?: number;

  @ApiProperty({
    description: '代幣 Logo URL',
    example: 'https://example.com/logo.png',
    required: false,
  })
  logo?: string;
}

/**
 * NFT 餘額 DTO
 */
export class NftBalanceDto {
  @ApiProperty({
    description: 'NFT 合約地址',
    example: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
  })
  address: string;

  @ApiProperty({
    description: 'NFT 標識符',
    example: '1234',
  })
  tokenId: string;

  @ApiProperty({
    description: 'NFT 名稱',
    example: 'Bored Ape Yacht Club #1234',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'NFT 符號',
    example: 'BAYC',
    required: false,
  })
  symbol?: string;

  @ApiProperty({
    description: 'NFT 圖片 URL',
    example: 'https://example.com/image.png',
    required: false,
  })
  image?: string;

  @ApiProperty({
    description: 'NFT 數量',
    example: '1',
    required: false,
  })
  balance?: string;

  @ApiProperty({
    description: 'NFT 地板價 (美元)',
    example: 10000,
    required: false,
  })
  floorPrice?: number;
}

/**
 * 資產組合回應 DTO - 遵循並實現 BalanceResponse 接口定義
 */
export class PortfolioResponseDto implements BalanceResponse {
  @ApiProperty({
    description: '原生代幣餘額',
    type: NativeBalanceDto,
  })
  nativeBalance: NativeBalanceDto;

  @ApiProperty({
    description: '代幣列表',
    type: [TokenBalanceDto],
    required: false,
  })
  tokens?: TokenBalanceDto[];

  @ApiProperty({
    description: 'NFT 列表',
    type: [NftBalanceDto],
    required: false,
  })
  nfts?: NftBalanceDto[];

  @ApiProperty({
    description: '資料更新時間戳',
    example: 1624269856,
  })
  updatedAt: number;

  // 支持 BalanceResponse 接口中的額外屬性
  [key: string]: any;
}
