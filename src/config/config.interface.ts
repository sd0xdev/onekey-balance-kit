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
  url?: string;
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

export interface BlockchainProviderConfig {
  apiKey: string;
  baseUrl: string;
}

export interface BlockchainProvidersConfig {
  alchemy: BlockchainProviderConfig;
  quicknode: BlockchainProviderConfig;
  infura: BlockchainProviderConfig;
}

export interface BlockchainConfig {
  alchemyApiKey?: string;
  alchemyToken?: string;
  infuraApiKey?: string;
  moralisApiKey?: string;
  defaultProviders?: Record<string, string>;
  defaultProvider?: string;
  enabledChains?: string[];
  providers?: BlockchainProvidersConfig;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
}

export interface ConfigInterface {
  app: AppConfig;
  database?: DatabaseConfig;
  mongo?: MongoConfig;
  redis?: RedisConfig;
  web3?: Web3Config;
  network: NetworkConfig;
  blockchain?: BlockchainConfig;
  webhook?: WebhookConfig;
}
