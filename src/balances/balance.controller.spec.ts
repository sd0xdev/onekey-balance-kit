import { Test, TestingModule } from '@nestjs/testing';
import { BalanceController } from './balance.controller';
import { BalanceService } from './services/balance.service';

describe('BalanceController', () => {
  let controller: BalanceController;
  let service: BalanceService;

  const mockBalanceService = { getPortfolio: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BalanceController],
      providers: [{ provide: BalanceService, useValue: mockBalanceService }],
    }).compile();

    controller = module.get<BalanceController>(BalanceController);
    service = module.get<BalanceService>(BalanceService);
    jest.clearAllMocks();
  });

  describe('getBalances', () => {
    it('should call BalanceService.getPortfolio and return result', async () => {
      const result = { assets: [] };
      mockBalanceService.getPortfolio.mockResolvedValue(result);

      const response = await controller.getBalances('testChain', 'testAddress');
      expect(response).toEqual(result);
      expect(mockBalanceService.getPortfolio).toHaveBeenCalledWith('testChain', 'testAddress');
    });
  });
});
