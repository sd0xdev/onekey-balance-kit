import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { ConfigService } from '@nestjs/config';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { validateAlchemySignature } from './utils/signature-validator';
import { Request } from 'express';

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async handleWebhook(
    @Headers('x-webhook-signature') signature: string,
    @Body() payload: WebhookEventDto,
    @Req() request: Request,
  ) {
    // 獲取webhook密鑰
    const secret = this.configService.get<string>('WEBHOOK_SECRET');

    if (!secret) {
      throw new BadRequestException('Webhook secret is not configured');
    }

    // 驗證來自Alchemy的簽名
    const rawBody = request.body ? JSON.stringify(request.body) : '';
    if (!signature || !validateAlchemySignature(signature, rawBody, secret)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // 處理webhook事件
    await this.webhookService.processWebhookEvent(payload);

    return { success: true };
  }
}
