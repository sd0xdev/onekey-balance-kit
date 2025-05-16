import { registerAs } from '@nestjs/config';
import { ConfigKey, Environment } from './constants';
import {
  AppConfig,
  DatabaseConfig,
  NetworkConfig,
  Web3Config,
  MongoConfig,
  RedisConfig,
} from './config.interface';

export const appConfig = registerAs(
  ConfigKey.App,
  (): AppConfig => ({
    env: (process.env.NODE_ENV as Environment) || Environment.Development,
    port: parseInt(process.env.PORT || '3000', 10),
    appName: process.env.APP_NAME || 'one-key-balance-kit',
  }),
);

export const databaseConfig = registerAs(
  ConfigKey.Database,
  (): DatabaseConfig => ({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'onekey',
  }),
);

export const mongoConfig = registerAs(
  ConfigKey.Mongo,
  (): MongoConfig => ({
    url: process.env.MONGO_URL,
    host: process.env.MONGO_HOST || 'localhost',
    port: parseInt(process.env.MONGO_PORT || '27017', 10),
    username: process.env.MONGO_USERNAME || 'onekey',
    password: process.env.MONGO_PASSWORD || 'onekey123',
    database: process.env.MONGO_DATABASE || 'onekey',
  }),
);

export const redisConfig = registerAs(
  ConfigKey.Redis,
  (): RedisConfig => ({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  }),
);

export const web3Config = registerAs(
  ConfigKey.Web3,
  (): Web3Config => ({
    rpcUrl: process.env.RPC_URL || 'https://mainnet.infura.io/v3/your-api-key',
    chainId: parseInt(process.env.CHAIN_ID || '1', 10),
    apiKey: process.env.API_KEY,
  }),
);

export const networkConfig = registerAs(
  ConfigKey.Network,
  (): NetworkConfig => ({
    timeout: parseInt(process.env.NETWORK_TIMEOUT || '30000', 10),
    retries: parseInt(process.env.NETWORK_RETRIES || '3', 10),
  }),
);

export const configurations = [
  appConfig,
  databaseConfig,
  mongoConfig,
  redisConfig,
  web3Config,
  networkConfig,
];
