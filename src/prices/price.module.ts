import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AbstractPriceService } from './interfaces/abstract-price.service';
import { MockPriceService } from './services/mock-price.service';

/**
 * 價格服務模組
 * 負責提供代幣價格查詢能力
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AbstractPriceService,
      useClass:
        process.env.NODE_ENV === 'production'
          ? MockPriceService // 待實現真實 API 服務後替換
          : MockPriceService,
    },
  ],
  exports: [AbstractPriceService],
})
export class PriceModule {}
