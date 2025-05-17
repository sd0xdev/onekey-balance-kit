import { ConnectOptions } from 'mongoose';

export interface AppConfig {
  env: string;
  port: number;
  appName: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface MongoConfig extends Partial<ConnectOptions> {
  url?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
}

export interface Web3Config {
  rpcUrl: string;
  chainId: number;
  apiKey?: string;
}

export interface NetworkConfig {
  timeout: number;
  retries: number;
}

export interface BlockchainConfig {
  alchemyApiKey?: string;
  infuraApiKey?: string;
  moralisApiKey?: string;
  defaultProviders?: Record<string, string>;
}

export interface ConfigInterface {
  app: AppConfig;
  database?: DatabaseConfig;
  mongo?: MongoConfig;
  redis?: RedisConfig;
  web3?: Web3Config;
  network: NetworkConfig;
  blockchain?: BlockchainConfig;
}
