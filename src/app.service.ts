import { Injectable } from '@nestjs/common';
import { AppConfigService } from './config';

@Injectable()
export class AppService {
  constructor(private readonly configService: AppConfigService) {}

  getHello(): string {
    return `歡迎使用 ${this.configService.app.appName}！運行在 ${this.configService.environment} 環境，端口 ${this.configService.port}`;
  }
}
