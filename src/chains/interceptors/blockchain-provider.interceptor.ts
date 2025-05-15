import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { BLOCKCHAIN_PROVIDER_KEY } from '../decorators/blockchain-provider.decorator';
import { ConfigService } from '@nestjs/config';

/**
 * 區塊鏈提供者攔截器
 *
 * 用於攔截請求並設置區塊鏈提供者
 * 優先順序: 1.查詢參數 2.方法裝飾器 3.控制器裝飾器 4.配置
 */
@Injectable()
export class BlockchainProviderInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // 從查詢參數獲取
    const providerFromQuery = request.query.provider;

    // 從方法裝飾器獲取
    const providerFromMethod = this.reflector.get(BLOCKCHAIN_PROVIDER_KEY, context.getHandler());

    // 從控制器裝飾器獲取
    const providerFromController = this.reflector.get(BLOCKCHAIN_PROVIDER_KEY, context.getClass());

    // 從配置獲取
    const defaultProvider = this.configService.get<string>('blockchain.defaultProvider', 'alchemy');

    // 按優先順序設置提供者
    request.blockchainProvider =
      providerFromQuery || providerFromMethod || providerFromController || defaultProvider;

    return next.handle();
  }
}
