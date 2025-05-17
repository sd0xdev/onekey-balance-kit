import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigKey } from './constants';
import {
  AppConfig,
  DatabaseConfig,
  NetworkConfig,
  Web3Config,
  MongoConfig,
  RedisConfig,
  BlockchainConfig,
  WebhookConfig,
} from './config.interface';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get app(): AppConfig {
    const config = this.configService.get<AppConfig>(ConfigKey.App as string);
    return config || ({} as AppConfig);
  }

  get database(): DatabaseConfig {
    const config = this.configService.get<DatabaseConfig>(ConfigKey.Database as string);
    return config || ({} as DatabaseConfig);
  }

  get mongo(): MongoConfig {
    const config = this.configService.get<MongoConfig>(ConfigKey.Mongo as string);
    return config || ({} as MongoConfig);
  }

  get redis(): RedisConfig {
    const config = this.configService.get<RedisConfig>(ConfigKey.Redis as string);
    return config || ({} as RedisConfig);
  }

  get web3(): Web3Config {
    const config = this.configService.get<Web3Config>(ConfigKey.Web3 as string);
    return config || ({} as Web3Config);
  }

  get network(): NetworkConfig {
    const config = this.configService.get<NetworkConfig>(ConfigKey.Network as string);
    return config || ({} as NetworkConfig);
  }

  get blockchain(): BlockchainConfig {
    const config = this.configService.get<BlockchainConfig>(ConfigKey.Blockchain as string);
    return config || ({} as BlockchainConfig);
  }

  get webhook(): WebhookConfig {
    const config = this.configService.get<WebhookConfig>(ConfigKey.Webhook as string);
    return config || ({} as WebhookConfig);
  }

  // 便捷方法，簡化常用配置項的訪問
  get port(): number {
    return this.app.port;
  }

  get environment(): string {
    return this.app.env;
  }

  get isProduction(): boolean {
    return this.app.env === 'production';
  }

  get isDevelopment(): boolean {
    return this.app.env === 'development';
  }
}
