import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from './config.service';
import { ConfigService } from '@nestjs/config';
import { ConfigKey } from './constants';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('app config', () => {
    it('should return app config when available', () => {
      const mockAppConfig = {
        env: 'development',
        port: 3000,
        appName: 'one-key-balance-kit',
      };

      mockConfigService.get.mockReturnValue(mockAppConfig);

      const result = service.app;

      expect(result).toEqual(mockAppConfig);
      expect(configService.get).toHaveBeenCalledWith(ConfigKey.App);
    });

    it('should return empty object when app config is not available', () => {
      mockConfigService.get.mockReturnValue(null);

      const result = service.app;

      expect(result).toEqual({});
    });
  });

  describe('database config', () => {
    it('should return database config when available', () => {
      const mockDbConfig = {
        host: 'localhost',
        port: 5432,
        username: 'postgres',
      };

      mockConfigService.get.mockReturnValue(mockDbConfig);

      const result = service.database;

      expect(result).toEqual(mockDbConfig);
      expect(configService.get).toHaveBeenCalledWith(ConfigKey.Database);
    });
  });

  describe('mongo config', () => {
    it('should return mongo config when available', () => {
      const mockMongoConfig = {
        url: 'mongodb://localhost:27017',
        database: 'onekey',
      };

      mockConfigService.get.mockReturnValue(mockMongoConfig);

      const result = service.mongo;

      expect(result).toEqual(mockMongoConfig);
      expect(configService.get).toHaveBeenCalledWith(ConfigKey.Mongo);
    });
  });

  describe('redis config', () => {
    it('should return redis config when available', () => {
      const mockRedisConfig = {
        host: 'localhost',
        port: 6379,
      };

      mockConfigService.get.mockReturnValue(mockRedisConfig);

      const result = service.redis;

      expect(result).toEqual(mockRedisConfig);
      expect(configService.get).toHaveBeenCalledWith(ConfigKey.Redis);
    });
  });

  describe('web3 config', () => {
    it('should return web3 config when available', () => {
      const mockWeb3Config = {
        rpcUrl: 'https://mainnet.infura.io/v3/key',
        chainId: 1,
      };

      mockConfigService.get.mockReturnValue(mockWeb3Config);

      const result = service.web3;

      expect(result).toEqual(mockWeb3Config);
      expect(configService.get).toHaveBeenCalledWith(ConfigKey.Web3);
    });
  });

  describe('network config', () => {
    it('should return network config when available', () => {
      const mockNetworkConfig = {
        timeout: 30000,
        retries: 3,
      };

      mockConfigService.get.mockReturnValue(mockNetworkConfig);

      const result = service.network;

      expect(result).toEqual(mockNetworkConfig);
      expect(configService.get).toHaveBeenCalledWith(ConfigKey.Network);
    });
  });

  describe('blockchain config', () => {
    it('should return blockchain config when available', () => {
      const mockBlockchainConfig = {
        alchemyApiKey: 'test-key',
        defaultProvider: 'alchemy',
      };

      mockConfigService.get.mockReturnValue(mockBlockchainConfig);

      const result = service.blockchain;

      expect(result).toEqual(mockBlockchainConfig);
      expect(configService.get).toHaveBeenCalledWith(ConfigKey.Blockchain);
    });
  });

  describe('webhook config', () => {
    it('should return webhook config when available', () => {
      const mockWebhookConfig = {
        url: 'https://test.com/webhook',
        secret: 'test-secret',
      };

      mockConfigService.get.mockReturnValue(mockWebhookConfig);

      const result = service.webhook;

      expect(result).toEqual(mockWebhookConfig);
      expect(configService.get).toHaveBeenCalledWith(ConfigKey.Webhook);
    });
  });

  describe('convenience methods', () => {
    it('should return port from app config', () => {
      mockConfigService.get.mockReturnValue({
        port: 3000,
      });

      const result = service.port;

      expect(result).toBe(3000);
    });

    it('should return environment from app config', () => {
      mockConfigService.get.mockReturnValue({
        env: 'development',
      });

      const result = service.environment;

      expect(result).toBe('development');
    });

    it('should return isProduction based on environment', () => {
      mockConfigService.get.mockReturnValue({
        env: 'production',
      });

      const result = service.isProduction;

      expect(result).toBe(true);
    });

    it('should return isDevelopment based on environment', () => {
      mockConfigService.get.mockReturnValue({
        env: 'development',
      });

      const result = service.isDevelopment;

      expect(result).toBe(true);
    });
  });
});
