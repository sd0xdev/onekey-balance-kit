import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

/**
 * 請求上下文服務
 *
 * 用於獲取當前請求上下文中的數據
 * 注意：此服務需要在 REQUEST 作用域中使用
 */
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  /**
   * 獲取當前請求的區塊鏈提供者
   *
   * @returns 提供者名稱或默認值 'alchemy'
   */
  getBlockchainProvider(): string {
    return (this.request as any).blockchainProvider || 'alchemy';
  }

  /**
   * 獲取整個請求對象
   *
   * @returns 請求對象
   */
  getRequest(): Request {
    return this.request;
  }
}
