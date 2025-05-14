import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigService } from './config';
import { BalanceService } from './core/balance/balance.service';

// 創建一個模擬的 AppConfigService
const mockAppConfigService = {
  app: {
    appName: 'Test App',
  },
  environment: 'test',
  port: 3000,
};

// 創建一個模擬的 BalanceService
const mockBalanceService = {
  getPortfolio: jest.fn().mockResolvedValue({
    total: '1000',
    assets: [],
  }),
};

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: AppConfigService,
          useValue: mockAppConfigService,
        },
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe(
        `歡迎使用 ${mockAppConfigService.app.appName}！運行在 ${mockAppConfigService.environment} 環境，端口 ${mockAppConfigService.port}`,
      );
    });
  });
});
