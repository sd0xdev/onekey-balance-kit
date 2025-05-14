import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DbService } from './db.service';
import { AppConfigService } from '../../config';
import { ConfigsModule } from '../../config/config.module';
import { WebhookEvent, WebhookEventSchema } from './schemas/webhook-event.schema';

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
          useNewUrlParser: true,
          useUnifiedTopology: true,
          autoCreate: true,
          autoIndex: true,
          authSource: 'admin',
        };
      },
    }),
    // 註冊所有 Schema
    MongooseModule.forFeature([{ name: WebhookEvent.name, schema: WebhookEventSchema }]),
  ],
  providers: [DbService],
  exports: [
    DbService,
    // 導出 MongooseModule，使其他模塊可以使用已註冊的模型
    MongooseModule,
  ],
})
export class DbModule {}
