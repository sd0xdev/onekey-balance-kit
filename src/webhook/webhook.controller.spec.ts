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
import * as signatureValidator from './utils/signature-validator';
import { Request } from 'express';
import { AppConfigService } from '../config/config.service';
import { WebhookManagementService } from './webhook-management.service';
import { ChainName } from '../chains/constants';

// 模擬 validateAlchemySignature 函數
jest.mock('./utils/signature-validator', () => ({
  validateAlchemySignature: jest.fn(),
}));

describe('WebhookController', () => {
  let controller: WebhookController;
  let appConfigService: AppConfigService;
  let webhookService: WebhookService;
  let webhookManagementService: WebhookManagementService;

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
          provide: AppConfigService,
          useValue: {
            get: jest.fn(),
            webhook: {
              url: 'https://example.com/webhook',
            },
          },
        },
        {
          provide: WebhookManagementService,
          useValue: {
            getSigningKeyByUrl: jest.fn().mockResolvedValue('test-webhook-secret'),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    appConfigService = module.get<AppConfigService>(AppConfigService);
    webhookService = module.get<WebhookService>(WebhookService);
    webhookManagementService = module.get<WebhookManagementService>(WebhookManagementService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleWebhook', () => {
    // 模擬數據
    const mockSignature = 'sha256=1234567890abcdef';
    const mockSecret = 'test-webhook-secret';
    const mockAddressActivityPayload: WebhookEventDto = {
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
            hash: '0xabc',
            blockNum: '12345',
            category: 'external',
          },
        ],
      } as AddressActivityEvent,
    };
    const mockNftActivityPayload: WebhookEventDto = {
      webhookId: 'webhook-id-123',
      id: 'event-id-123',
      createdAt: new Date().toISOString(),
      type: WebhookEventType.NFT_ACTIVITY,
      event: {
        network: 'POLY_MAINNET',
        activity: [
          {
            fromAddress: '0x123',
            toAddress: '0x456',
            contractAddress: '0x789',
            erc721TokenId: '42',
            category: 'erc721',
          },
        ],
      } as NftActivityEvent,
    };
    const mockMinedTransactionPayload: WebhookEventDto = {
      webhookId: 'webhook-id-123',
      id: 'event-id-123',
      createdAt: new Date().toISOString(),
      type: WebhookEventType.MINED_TRANSACTION,
      event: {
        network: 'BSC_MAINNET',
        hash: '0xabc123',
        from: '0x123',
        to: '0x456',
        blockNum: '12345',
        status: 'success',
        gasUsed: '21000',
      } as MinedTransactionEvent,
    };

    const mockRequest = (payload: any) =>
      ({
        body: payload,
        rawBody: Buffer.from(JSON.stringify(payload)),
      }) as any;

    it('應該在簽名驗證通過後成功處理webhook事件 (ADDRESS_ACTIVITY)', async () => {
      // 設置模擬返回
      jest.spyOn(webhookManagementService, 'getSigningKeyByUrl').mockResolvedValue(mockSecret);
      (signatureValidator.validateAlchemySignature as jest.Mock).mockReturnValue(true);

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
      expect(signatureValidator.validateAlchemySignature).toHaveBeenCalled();
      expect(webhookService.processWebhookEvent).toHaveBeenCalledWith(mockAddressActivityPayload);
      expect(result).toEqual({ success: true });
    });

    it('應該在簽名驗證通過後成功處理webhook事件 (NFT_ACTIVITY)', async () => {
      // 設置模擬返回
      jest.spyOn(webhookManagementService, 'getSigningKeyByUrl').mockResolvedValue(mockSecret);
      (signatureValidator.validateAlchemySignature as jest.Mock).mockReturnValue(true);

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
      expect(signatureValidator.validateAlchemySignature).toHaveBeenCalled();
      expect(webhookService.processWebhookEvent).toHaveBeenCalledWith(mockNftActivityPayload);
      expect(result).toEqual({ success: true });
    });

    it('應該在簽名驗證通過後成功處理webhook事件 (MINED_TRANSACTION)', async () => {
      // 設置模擬返回
      jest.spyOn(webhookManagementService, 'getSigningKeyByUrl').mockResolvedValue(mockSecret);
      (signatureValidator.validateAlchemySignature as jest.Mock).mockReturnValue(true);

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
      expect(signatureValidator.validateAlchemySignature).toHaveBeenCalled();
      expect(webhookService.processWebhookEvent).toHaveBeenCalledWith(mockMinedTransactionPayload);
      expect(result).toEqual({ success: true });
    });

    it('當webhookUrl未配置時，應拋出BadRequestException', async () => {
      // 修改配置
      Object.defineProperty(appConfigService, 'webhook', {
        get: jest.fn().mockReturnValue({ url: undefined }),
      });

      // 驗證
      await expect(
        controller.handleWebhook(
          mockSignature,
          mockAddressActivityPayload,
          mockRequest(mockAddressActivityPayload),
        ),
      ).rejects.toThrow(BadRequestException);

      expect(webhookManagementService.getSigningKeyByUrl).not.toHaveBeenCalled();
      expect(webhookService.processWebhookEvent).not.toHaveBeenCalled();
    });

    it('當webhook密鑰未配置時，應拋出UnauthorizedException', async () => {
      // 設置模擬返回
      jest.spyOn(webhookManagementService, 'getSigningKeyByUrl').mockResolvedValue(null);

      // 驗證
      await expect(
        controller.handleWebhook(
          mockSignature,
          mockAddressActivityPayload,
          mockRequest(mockAddressActivityPayload),
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(webhookManagementService.getSigningKeyByUrl).toHaveBeenCalled();
      expect(webhookService.processWebhookEvent).not.toHaveBeenCalled();
    });

    it('當簽名驗證失敗時，應拋出UnauthorizedException', async () => {
      // 設置模擬返回
      jest.spyOn(webhookManagementService, 'getSigningKeyByUrl').mockResolvedValue(mockSecret);
      (signatureValidator.validateAlchemySignature as jest.Mock).mockReturnValue(false);

      // 驗證
      await expect(
        controller.handleWebhook(
          mockSignature,
          mockAddressActivityPayload,
          mockRequest(mockAddressActivityPayload),
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(webhookManagementService.getSigningKeyByUrl).toHaveBeenCalled();
      expect(signatureValidator.validateAlchemySignature).toHaveBeenCalled();
      expect(webhookService.processWebhookEvent).not.toHaveBeenCalled();
    });

    it('當簽名缺失時，應拋出UnauthorizedException', async () => {
      // 設置模擬返回
      jest.spyOn(webhookManagementService, 'getSigningKeyByUrl').mockResolvedValue(mockSecret);

      // 驗證
      await expect(
        controller.handleWebhook(
          '',
          mockAddressActivityPayload,
          mockRequest(mockAddressActivityPayload),
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(webhookManagementService.getSigningKeyByUrl).not.toHaveBeenCalled();
      expect(webhookService.processWebhookEvent).not.toHaveBeenCalled();
    });
  });
});
