import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import {
  WebhookEventDto,
  WebhookEventType,
  AddressActivityEvent,
  NftActivityEvent,
  MinedTransactionEvent,
} from './dto/webhook-event.dto';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as signatureValidatorModule from './utils/signature-validator';
import { Request } from 'express';
import { AppConfigService } from '../config/config.service';
import { WebhookManagementService } from './webhook-management.service';
import { ChainName } from '../chains/constants';

// 直接模擬 signature-validator 模組
jest.mock('./utils/signature-validator', () => ({
  validateAlchemySignature: jest.fn().mockReturnValue(true),
}));

describe('WebhookController', () => {
  let controller: WebhookController;
  let appConfigService: AppConfigService;
  let webhookService: WebhookService;
  let webhookManagementService: WebhookManagementService;

  beforeEach(async () => {
    // 重置所有模擬
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: WebhookService,
          useValue: {
            processWebhookEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AppConfigService,
          useValue: {
            webhook: {
              url: 'https://example.com/webhook',
            },
          },
        },
        {
          provide: WebhookManagementService,
          useValue: {
            getSigningKeyByUrl: jest.fn(),
            clearSigningKeyCache: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    appConfigService = module.get<AppConfigService>(AppConfigService);
    webhookService = module.get<WebhookService>(WebhookService);
    webhookManagementService = module.get<WebhookManagementService>(WebhookManagementService);

    // 默認模擬 getSigningKeyByUrl 返回有效值
    (webhookManagementService.getSigningKeyByUrl as jest.Mock).mockImplementation((url, chain) => {
      // 對所有鏈返回相同的簽名密鑰
      return Promise.resolve('test-webhook-secret');
    });

    // 默認模擬簽名驗證通過
    (signatureValidatorModule.validateAlchemySignature as jest.Mock).mockReturnValue(true);
  });

  // 模擬數據
  const mockSignature = 'sha256=1234567890abcdef';
  const mockSecret = 'test-webhook-secret';

  const mockAddressActivityPayload = {
    webhookId: 'webhook123',
    id: 'event123',
    createdAt: new Date().toISOString(),
    type: WebhookEventType.ADDRESS_ACTIVITY,
    event: {
      network: 'ETH_MAINNET',
      activity: [],
    },
  };

  const mockNftActivityPayload = {
    webhookId: 'webhook123',
    id: 'event456',
    createdAt: new Date().toISOString(),
    type: WebhookEventType.NFT_ACTIVITY,
    event: {
      network: 'POLY_MAINNET',
      activity: [],
    },
  };

  const mockMinedTransactionPayload = {
    webhookId: 'webhook123',
    id: 'event789',
    createdAt: new Date().toISOString(),
    type: WebhookEventType.MINED_TRANSACTION,
    event: {
      network: 'BSC_MAINNET',
      activity: [],
    },
  };

  // 模擬 Request 對象
  const mockRequest = (body: any) => {
    return {
      body,
      rawBody: Buffer.from(JSON.stringify(body)),
      headers: {
        'x-alchemy-signature': mockSignature,
      },
      get: jest.fn().mockImplementation((key) => {
        if (key === 'x-alchemy-signature') return mockSignature;
        return null;
      }),
    } as any;
  };

  describe('handleWebhook', () => {
    it('應該在簽名驗證通過後成功處理webhook事件 (ADDRESS_ACTIVITY)', async () => {
      // 執行
      const result = await controller.handleWebhook(
        mockSignature,
        mockAddressActivityPayload,
        mockRequest(mockAddressActivityPayload),
      );

      // 驗證
      expect(webhookManagementService.getSigningKeyByUrl).toHaveBeenCalledWith(
        'https://example.com/webhook',
        ChainName.ETHEREUM,
      );
      expect(signatureValidatorModule.validateAlchemySignature).toHaveBeenCalled();
      expect(webhookService.processWebhookEvent).toHaveBeenCalledWith(mockAddressActivityPayload);
      expect(result).toEqual({ success: true });
    });

    it('應該在簽名驗證通過後成功處理webhook事件 (NFT_ACTIVITY)', async () => {
      // 執行
      const result = await controller.handleWebhook(
        mockSignature,
        mockNftActivityPayload,
        mockRequest(mockNftActivityPayload),
      );

      // 驗證
      expect(webhookManagementService.getSigningKeyByUrl).toHaveBeenCalledWith(
        'https://example.com/webhook',
        ChainName.POLYGON,
      );
      expect(signatureValidatorModule.validateAlchemySignature).toHaveBeenCalled();
      expect(webhookService.processWebhookEvent).toHaveBeenCalledWith(mockNftActivityPayload);
      expect(result).toEqual({ success: true });
    });

    it('應該在簽名驗證通過後成功處理webhook事件 (MINED_TRANSACTION)', async () => {
      // 執行
      const result = await controller.handleWebhook(
        mockSignature,
        mockMinedTransactionPayload,
        mockRequest(mockMinedTransactionPayload),
      );

      // 驗證
      expect(webhookManagementService.getSigningKeyByUrl).toHaveBeenCalledWith(
        'https://example.com/webhook',
        ChainName.BSC,
      );
      expect(signatureValidatorModule.validateAlchemySignature).toHaveBeenCalled();
      expect(webhookService.processWebhookEvent).toHaveBeenCalledWith(mockMinedTransactionPayload);
      expect(result).toEqual({ success: true });
    });

    it('當簽名驗證失敗時，應拋出UnauthorizedException', async () => {
      // 特別設置這個測試的簽名驗證失敗
      (signatureValidatorModule.validateAlchemySignature as jest.Mock).mockReturnValue(false);

      // 驗證
      await expect(
        controller.handleWebhook(
          mockSignature,
          mockAddressActivityPayload,
          mockRequest(mockAddressActivityPayload),
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(webhookManagementService.getSigningKeyByUrl).toHaveBeenCalled();
      expect(signatureValidatorModule.validateAlchemySignature).toHaveBeenCalled();
      expect(webhookService.processWebhookEvent).not.toHaveBeenCalled();
    });
  });
});
