import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DbService } from './db.service';
import { AppConfigService } from '../../config';
import { ConfigsModule } from '../../config/config.module';
import { WebhookEvent, WebhookEventSchema } from './schemas/webhook-event.schema';
import { PortfolioSnapshot, PortfolioSnapshotSchema } from './schemas/portfolio-snapshot.schema';
import { PortfolioHistory, PortfolioHistorySchema } from './schemas/portfolio-history.schema';
import { TxHistory, TxHistorySchema } from './schemas/tx-history.schema';
import { NftOwner, NftOwnerSchema } from './schemas/nft-owner.schema';
import { NftMeta, NftMetaSchema } from './schemas/nft-meta.schema';
import { PriceCache, PriceCacheSchema } from './schemas/price-cache.schema';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigsModule],
      inject: [AppConfigService],
      useFactory: (appConfigService: AppConfigService) => {
        const { host, port, username, password, database, url } = appConfigService.mongo;

        // 優先使用配置中的完整URL
        const uri =
          url ||
          (username && password
            ? `mongodb://${username}:${password}@${host}:${port}/${database}`
            : `mongodb://${host}:${port}/${database}`);

        console.log('MongoDB connection string configured successfully');

        return {
          uri,
          autoCreate: true,
          autoIndex: true,
          authSource: 'admin',
        };
      },
    }),
    // 註冊所有 Schema
    MongooseModule.forFeature([
      { name: WebhookEvent.name, schema: WebhookEventSchema },
      { name: PortfolioSnapshot.name, schema: PortfolioSnapshotSchema },
      { name: PortfolioHistory.name, schema: PortfolioHistorySchema },
      { name: TxHistory.name, schema: TxHistorySchema },
      { name: NftOwner.name, schema: NftOwnerSchema },
      { name: NftMeta.name, schema: NftMetaSchema },
      { name: PriceCache.name, schema: PriceCacheSchema },
    ]),
  ],
  providers: [DbService],
  exports: [
    DbService,
    // 導出 MongooseModule，使其他模塊可以使用已註冊的模型
    MongooseModule,
  ],
})
export class DbModule {}
