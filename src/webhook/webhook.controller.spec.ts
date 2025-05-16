import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WebhookEventDto, WebhookEventType, AddressActivityEvent } from './dto/webhook-event.dto';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as signatureValidator from './utils/signature-validator';
import { Request } from 'express';

// 模擬 validateAlchemySignature 函數
jest.mock('./utils/signature-validator', () => ({
  validateAlchemySignature: jest.fn(),
}));

describe('WebhookController', () => {
  let controller: WebhookController;
  let configService: ConfigService;
  let webhookService: WebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: WebhookService,
          useValue: {
            processWebhookEvent: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    configService = module.get<ConfigService>(ConfigService);
    webhookService = module.get<WebhookService>(WebhookService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleWebhook', () => {
    // 模擬數據
    const mockSignature = 'sha256=1234567890abcdef';
    const mockSecret = 'test-webhook-secret';
    const mockPayload: WebhookEventDto = {
      webhookId: 'webhook-id-123',
      id: 'event-id-123',
      createdAt: new Date().toISOString(),
      type: WebhookEventType.ADDRESS_ACTIVITY,
      event: {
        network: 'ETH_MAINNET',
        activity: [
          {
            fromAddress: '0x123',
            toAddress: '0x456',
            hash: '0xabc', // 這是合法的，因為AddressActivityEvent有hash屬性
            blockNum: '12345',
            category: 'external',
          },
        ],
      } as AddressActivityEvent,
    };
    const mockRequest = {
      body: mockPayload,
    } as Request;

    it('應該在簽名驗證通過後成功處理webhook事件', async () => {
      // 設置模擬返回
      jest.spyOn(configService, 'get').mockReturnValue(mockSecret);
      (signatureValidator.validateAlchemySignature as jest.Mock).mockReturnValue(true);

      // 執行
      const result = await controller.handleWebhook(mockSignature, mockPayload, mockRequest);

      // 驗證
      expect(configService.get).toHaveBeenCalledWith('WEBHOOK_SECRET');
      expect(signatureValidator.validateAlchemySignature).toHaveBeenCalledWith(
        mockSignature,
        JSON.stringify(mockPayload),
        mockSecret,
      );
      expect(webhookService.processWebhookEvent).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual({ success: true });
    });

    it('當webhook密鑰未配置時，應拋出BadRequestException', async () => {
      // 設置模擬返回
      jest.spyOn(configService, 'get').mockReturnValue(null);

      // 驗證
      await expect(
        controller.handleWebhook(mockSignature, mockPayload, mockRequest),
      ).rejects.toThrow(BadRequestException);

      expect(configService.get).toHaveBeenCalledWith('WEBHOOK_SECRET');
      expect(webhookService.processWebhookEvent).not.toHaveBeenCalled();
    });

    it('當簽名驗證失敗時，應拋出UnauthorizedException', async () => {
      // 設置模擬返回
      jest.spyOn(configService, 'get').mockReturnValue(mockSecret);
      (signatureValidator.validateAlchemySignature as jest.Mock).mockReturnValue(false);

      // 驗證
      await expect(
        controller.handleWebhook(mockSignature, mockPayload, mockRequest),
      ).rejects.toThrow(UnauthorizedException);

      expect(configService.get).toHaveBeenCalledWith('WEBHOOK_SECRET');
      expect(signatureValidator.validateAlchemySignature).toHaveBeenCalledWith(
        mockSignature,
        JSON.stringify(mockPayload),
        mockSecret,
      );
      expect(webhookService.processWebhookEvent).not.toHaveBeenCalled();
    });

    it('當簽名缺失時，應拋出UnauthorizedException', async () => {
      // 設置模擬返回
      jest.spyOn(configService, 'get').mockReturnValue(mockSecret);

      // 驗證
      await expect(controller.handleWebhook('', mockPayload, mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(configService.get).toHaveBeenCalledWith('WEBHOOK_SECRET');
      expect(webhookService.processWebhookEvent).not.toHaveBeenCalled();
    });
  });
});
