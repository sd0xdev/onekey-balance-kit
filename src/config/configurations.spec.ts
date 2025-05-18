import {
  appConfig,
  databaseConfig,
  mongoConfig,
  redisConfig,
  web3Config,
  networkConfig,
  blockchainConfig,
  webhookConfig,
} from './configurations';
import { Environment } from './constants';

describe('Configuration Factories', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('appConfig', () => {
    it('should return default app config when env vars are not set', () => {
      const config = appConfig();

      expect(config).toEqual({
        env: Environment.Development,
        port: 3000,
        appName: 'one-key-balance-kit',
      });
    });

    it('should use environment variables when set', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '4000';
      process.env.APP_NAME = 'custom-app-name';

      const config = appConfig();

      expect(config).toEqual({
        env: 'production',
        port: 4000,
        appName: 'custom-app-name',
      });
    });
  });

  describe('databaseConfig', () => {
    it('should return default database config when env vars are not set', () => {
      const config = databaseConfig();

      expect(config).toEqual({
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'postgres',
        database: 'onekey',
      });
    });

    it('should use environment variables when set', () => {
      process.env.DATABASE_HOST = 'db.example.com';
      process.env.DATABASE_PORT = '5433';
      process.env.DATABASE_USERNAME = 'user';
      process.env.DATABASE_PASSWORD = 'pass';
      process.env.DATABASE_NAME = 'mydb';

      const config = databaseConfig();

      expect(config).toEqual({
        host: 'db.example.com',
        port: 5433,
        username: 'user',
        password: 'pass',
        database: 'mydb',
      });
    });
  });

  describe('mongoConfig', () => {
    it('should return default MongoDB config when env vars are not set', () => {
      const config = mongoConfig();

      expect(config).toEqual({
        url: undefined,
        host: 'localhost',
        port: 27017,
        username: 'onekey',
        password: 'onekey123',
        database: 'onekey',
      });
    });

    it('should use environment variables when set', () => {
      process.env.MONGO_URL = 'mongodb://user:pass@mongo.example.com:27018/testdb';
      process.env.MONGO_HOST = 'mongo.example.com';
      process.env.MONGO_PORT = '27018';
      process.env.MONGO_USERNAME = 'user';
      process.env.MONGO_PASSWORD = 'pass';
      process.env.MONGO_DATABASE = 'testdb';

      const config = mongoConfig();

      expect(config).toEqual({
        url: 'mongodb://user:pass@mongo.example.com:27018/testdb',
        host: 'mongo.example.com',
        port: 27018,
        username: 'user',
        password: 'pass',
        database: 'testdb',
      });
    });
  });

  describe('redisConfig', () => {
    it('should return default Redis config when env vars are not set', () => {
      const config = redisConfig();

      expect(config).toEqual({
        host: 'localhost',
        port: 6379,
        password: '',
        db: 0,
      });
    });

    it('should use environment variables when set', () => {
      process.env.REDIS_HOST = 'redis.example.com';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'secret';
      process.env.REDIS_DB = '1';

      const config = redisConfig();

      expect(config).toEqual({
        host: 'redis.example.com',
        port: 6380,
        password: 'secret',
        db: 1,
      });
    });
  });

  describe('web3Config', () => {
    it('should return default Web3 config when env vars are not set', () => {
      const config = web3Config();

      expect(config).toEqual({
        rpcUrl: 'https://mainnet.infura.io/v3/your-api-key',
        chainId: 1,
        apiKey: undefined,
      });
    });

    it('should use environment variables when set', () => {
      process.env.RPC_URL = 'https://custom-rpc.example.com';
      process.env.CHAIN_ID = '42';
      process.env.API_KEY = 'test-api-key';

      const config = web3Config();

      expect(config).toEqual({
        rpcUrl: 'https://custom-rpc.example.com',
        chainId: 42,
        apiKey: 'test-api-key',
      });
    });
  });

  describe('networkConfig', () => {
    it('should return default network config when env vars are not set', () => {
      const config = networkConfig();

      expect(config).toEqual({
        timeout: 30000,
        retries: 3,
      });
    });

    it('should use environment variables when set', () => {
      process.env.NETWORK_TIMEOUT = '5000';
      process.env.NETWORK_RETRIES = '5';

      const config = networkConfig();

      expect(config).toEqual({
        timeout: 5000,
        retries: 5,
      });
    });
  });

  describe('blockchainConfig', () => {
    it('should return default blockchain config when env vars are not set', () => {
      const config = blockchainConfig();

      expect(config).toEqual({
        alchemyApiKey: undefined,
        alchemyToken: undefined,
        infuraApiKey: undefined,
        moralisApiKey: undefined,
        defaultProviders: {
          ethereum: 'alchemy',
          polygon: 'alchemy',
          bsc: 'alchemy',
          solana: 'alchemy',
        },
        defaultProvider: 'alchemy',
        enabledChains: ['ETH'],
        providers: {
          alchemy: {
            apiKey: '',
            baseUrl: 'https://eth-mainnet.g.alchemy.com/v2/',
          },
          quicknode: {
            apiKey: '',
            baseUrl: 'https://api.quicknode.com/',
          },
          infura: {
            apiKey: '',
            baseUrl: 'https://mainnet.infura.io/v3/',
          },
        },
      });
    });

    it('should use environment variables when set', () => {
      process.env.ALCHEMY_API_KEY = 'alchemy-key';
      process.env.ALCHEMY_TOKEN = 'alchemy-token';
      process.env.INFURA_API_KEY = 'infura-key';
      process.env.MORALIS_API_KEY = 'moralis-key';
      process.env.DEFAULT_ETH_PROVIDER = 'infura';
      process.env.DEFAULT_BLOCKCHAIN_PROVIDER = 'quicknode';
      process.env.ENABLE_CHAINS = 'ETH,BSC,POLYGON';

      const config = blockchainConfig();

      expect(config).toEqual({
        alchemyApiKey: 'alchemy-key',
        alchemyToken: 'alchemy-token',
        infuraApiKey: 'infura-key',
        moralisApiKey: 'moralis-key',
        defaultProviders: {
          ethereum: 'infura',
          polygon: 'alchemy',
          bsc: 'alchemy',
          solana: 'alchemy',
        },
        defaultProvider: 'quicknode',
        enabledChains: ['ETH', 'BSC', 'POLYGON'],
        providers: expect.any(Object),
      });
    });
  });

  describe('webhookConfig', () => {
    it('should return default webhook config when env vars are not set', () => {
      const config = webhookConfig();

      expect(config).toEqual({
        url: 'https://your-api-url/webhook',
        secret: undefined,
      });
    });

    it('should use environment variables when set', () => {
      process.env.WEBHOOK_URL = 'https://custom-webhook.example.com';
      process.env.WEBHOOK_SECRET = 'custom-secret';

      const config = webhookConfig();

      expect(config).toEqual({
        url: 'https://custom-webhook.example.com',
        secret: 'custom-secret',
      });
    });
  });
});
