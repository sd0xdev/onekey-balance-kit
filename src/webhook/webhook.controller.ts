import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { validateAlchemySignature } from './utils/signature-validator';
import { Request } from 'express';
import { WebhookManagementService } from './webhook-management.service';
import { AppConfigService } from '../config/config.service';
import { WebhookEventType } from './dto/webhook-event.dto';
import {
  AddressActivityEvent,
  NftActivityEvent,
  MinedTransactionEvent,
} from './dto/webhook-event.dto';
import { NETWORK_ID_TO_CHAIN_MAP } from '../chains/constants';
import { ChainName } from '../chains/constants';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly configService: AppConfigService,
    private readonly webhookManagementService: WebhookManagementService,
  ) {}

  @Post()
  async handleWebhook(
    @Headers('x-alchemy-signature') signature: string,
    @Body() payload: WebhookEventDto,
    @Req() request: Request,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing signature');
    }

    // 獲取當前 webhook 的 URL（來自配置）
    const webhookUrl = this.configService.webhook?.url;
    if (!webhookUrl) {
      throw new BadRequestException('Webhook URL is not configured');
    }

    // 嘗試從 webhook payload 中獲取網絡信息
    let networkId: string | undefined;

    // 根據事件類型提取相關網絡信息
    if (payload.type === WebhookEventType.ADDRESS_ACTIVITY) {
      const event = payload.event as AddressActivityEvent;
      // 提取網絡信息
      networkId = event.network;
    } else if (payload.type === WebhookEventType.NFT_ACTIVITY) {
      const event = payload.event as NftActivityEvent;
      // 提取網絡信息
      networkId = event.network;
    } else if (
      payload.type === WebhookEventType.MINED_TRANSACTION ||
      payload.type === WebhookEventType.DROPPED_TRANSACTION
    ) {
      const event = payload.event as MinedTransactionEvent;
      // 提取網絡信息
      networkId = event.network;
    }

    // 將網絡標識符轉換為鏈名稱
    const chainName = networkId ? NETWORK_ID_TO_CHAIN_MAP[networkId] : undefined;

    // 動態獲取 signing_key，優先使用鏈名稱
    let signingKey: string | null = null;
    if (chainName) {
      // 使用鏈名稱查找 signing_key
      signingKey = await this.webhookManagementService.getSigningKeyByUrl(webhookUrl, chainName);
    }

    if (!signingKey) {
      // 如果找不到對應的 signing_key，直接拒絕處理該 webhook
      this.logger.error(`無法獲取 webhook signing key`);
      throw new UnauthorizedException('Cannot verify webhook: signing key not found');
    }

    // 使用動態獲取的 signing_key 驗證簽名
    const rawBody = (request as any).rawBody as Buffer;
    if (!validateAlchemySignature(signature, rawBody, signingKey)) {
      // remove all signing key cache
      this.webhookManagementService.clearSigningKeyCache();
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.debug(`使用鏈 ${chainName} 的 signing_key 驗證成功`);

    // 處理webhook事件
    await this.webhookService.processWebhookEvent(payload);

    return { success: true };
  }
}
