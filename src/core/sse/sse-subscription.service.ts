import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Observable, Subject, fromEvent, interval, merge, of, throwError } from 'rxjs';
import { map, shareReplay, takeUntil, catchError, filter } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import {
  CacheInvalidationEventType,
  AddressCacheInvalidatedEvent,
} from '../../notification/notification.service';
import { ChainName } from '../../chains/constants';

// 定義本地的 AddressSubscription 接口，取代從 sse.controller 中的引用
interface AddressSubscription {
  chain?: ChainName;
  chainId?: number;
  address?: string;
  pattern?: string;
}

export enum CacheEventType {
  INVALIDATE = 'cache.invalidate',
  HEARTBEAT = 'heartbeat',
}

export interface CacheInvalidateEvent {
  key: string;
  pattern?: string;
  timestamp: number;
  id: string;
  // 額外元數據，用於過濾
  metadata?: {
    chain?: ChainName;
    chainId?: number;
    address?: string;
  };
}

interface MessageEvent {
  data: string;
  id?: string;
  type?: string;
  retry?: number;
}

// 客戶端連接信息接口
interface ClientConnection {
  id: string;
  lastActive: number;
  subject: Subject<void>;
  isActive: boolean;
  // 新增訂閱過濾條件
  subscription?: AddressSubscription;
}

const MAX_STORED_EVENTS = 100;
const HEARTBEAT_INTERVAL = 25000; // 25秒
const CLIENT_TIMEOUT = 30000; // 30秒超時

@Injectable()
export class SseSubscriptionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseSubscriptionService.name);
  private readonly destroy$ = new Subject<void>();

  // 保存最近的事件用於回溯重放
  private readonly recentEvents: CacheInvalidateEvent[] = [];

  // 主要的事件流，被所有訂閱者共享
  private readonly cacheEvents$: Observable<MessageEvent>;

  // 追蹤活躍的客戶端連接數
  private activeConnections = 0;

  // 保存客戶端連接信息，用於活躍性追蹤
  private clients: Map<string, ClientConnection> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {
    // 創建一個可共享的 Observable 用於廣播事件
    this.cacheEvents$ = this.createEventsObservable();
  }

  async onModuleInit() {
    try {
      // 設置心跳定時器 - 系統內部心跳，不是發送給客戶端的
      interval(HEARTBEAT_INTERVAL)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.eventEmitter.emit(CacheEventType.HEARTBEAT, {
            timestamp: Date.now(),
            id: `heartbeat-${Date.now()}`,
          });
        });

      // 設置客戶端超時檢查定時器
      interval(10000) // 每10秒檢查一次
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.checkClientTimeouts();
        });
    } catch (error) {
      this.logger.error(`初始化 SSE 服務失敗: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    try {
      this.destroy$.next();
      this.destroy$.complete();

      // 清理所有剩餘的客戶端連接
      for (const [clientId, client] of this.clients.entries()) {
        if (client.isActive) {
          client.subject.next();
          client.subject.complete();
        }
      }
      this.clients.clear();
    } catch (error) {
      this.logger.error(`關閉 SSE 服務時出錯: ${error.message}`);
    }
  }

  /**
   * 為客戶端創建事件流
   * @param clientId 客戶端ID (從控制器傳入)
   * @param lastEventId 最後接收的事件ID (用於重播事件)
   */
  getEventStream(clientId: string, lastEventId?: string): Observable<MessageEvent> {
    try {
      // 使用傳入的客戶端 ID 註冊客戶端
      this.registerClient(clientId);

      this.activeConnections++;

      // 如果有 lastEventId，嘗試重放之前的事件
      const replayEvents: MessageEvent[] = [];
      if (lastEventId) {
        const lastEvents = this.getEventsSince(lastEventId);
        replayEvents.push(...lastEvents.map((event) => this.formatCacheEvent(event)));
      }

      const replay$ =
        replayEvents.length > 0
          ? new Observable<MessageEvent>((subscriber) => {
              replayEvents.forEach((event) => subscriber.next(event));
              subscriber.complete();
            })
          : new Observable<MessageEvent>((subscriber) => subscriber.complete());

      // 獲取客戶端的終止主題
      const clientSubject = this.clients.get(clientId)?.subject;
      if (!clientSubject) {
        return throwError(() => new Error(`無法獲取客戶端 ${clientId} 的終止主題`));
      }

      // 合併重放事件和新事件
      return merge(replay$, this.cacheEvents$).pipe(
        takeUntil(
          merge(
            clientSubject, // 客戶端超時時會觸發
            new Observable((subscriber) => {
              return () => {
                this.unregisterClient(clientId);
                this.activeConnections--;
                this.logger.debug(`客戶端斷開連接，剩餘連接: ${this.activeConnections}`);
                subscriber.complete();
              };
            }),
          ),
        ),
        catchError((error) => {
          this.logger.error(`客戶端 ${clientId} 的事件流發生錯誤: ${error.message}`);
          this.unregisterClient(clientId);
          return of({ data: `Error: ${error.message}` });
        }),
      );
    } catch (error) {
      this.logger.error(`創建客戶端 ${clientId} 的事件流時出錯: ${error.message}`);
      return throwError(() => error);
    }
  }

  /**
   * 為客戶端創建過濾後的事件流
   * @param clientId 客戶端ID
   * @param subscription 訂閱過濾條件
   * @param lastEventId 最後接收的事件ID (用於重播事件)
   */
  getFilteredEventStream(
    clientId: string,
    subscription: AddressSubscription,
    lastEventId?: string,
  ): Observable<MessageEvent> {
    try {
      // 使用傳入的客戶端 ID 註冊客戶端，並設置過濾條件
      this.registerClient(clientId, subscription);

      this.activeConnections++;

      // 如果有 lastEventId，嘗試重放之前的事件（並應用過濾）
      const replayEvents: MessageEvent[] = [];
      if (lastEventId) {
        const lastEvents = this.getEventsSince(lastEventId);
        const filteredEvents = lastEvents.filter((event) =>
          this.matchesSubscription(event, subscription),
        );
        replayEvents.push(...filteredEvents.map((event) => this.formatCacheEvent(event)));
      }

      const replay$ =
        replayEvents.length > 0
          ? new Observable<MessageEvent>((subscriber) => {
              replayEvents.forEach((event) => subscriber.next(event));
              subscriber.complete();
            })
          : new Observable<MessageEvent>((subscriber) => subscriber.complete());

      // 獲取客戶端的終止主題
      const clientSubject = this.clients.get(clientId)?.subject;
      if (!clientSubject) {
        return throwError(() => new Error(`無法獲取客戶端 ${clientId} 的終止主題`));
      }

      // 過濾事件流以只包含與訂閱條件匹配的事件
      const filteredEvents$ = this.cacheEvents$.pipe(
        filter((message: MessageEvent) => {
          if (!message || !message.data || message.data.startsWith(':')) {
            return false; // 跳過心跳等註釋消息
          }

          try {
            // 解析事件數據
            const eventData = JSON.parse(message.data);

            // 檢查該事件是否與訂閱條件匹配
            return this.matchesSubscriptionMessage(eventData, subscription);
          } catch (e) {
            return false;
          }
        }),
      );

      // 合併重放事件和過濾後的新事件
      return merge(replay$, filteredEvents$).pipe(
        takeUntil(
          merge(
            clientSubject,
            new Observable((subscriber) => {
              return () => {
                this.unregisterClient(clientId);
                this.activeConnections--;
                this.logger.debug(`客戶端斷開連接，剩餘連接: ${this.activeConnections}`);
                subscriber.complete();
              };
            }),
          ),
        ),
        catchError((error) => {
          this.logger.error(`客戶端 ${clientId} 的過濾事件流發生錯誤: ${error.message}`);
          this.unregisterClient(clientId);
          return of({ data: `Error: ${error.message}` } as MessageEvent);
        }),
      );
    } catch (error) {
      this.logger.error(`創建客戶端 ${clientId} 的過濾事件流時出錯: ${error.message}`);
      return throwError(() => error);
    }
  }

  /**
   * 檢查事件是否匹配訂閱條件
   */
  private matchesSubscription(
    event: CacheInvalidateEvent,
    subscription: AddressSubscription,
  ): boolean {
    // 如果事件沒有元數據，嘗試從鍵中提取信息
    if (!event.metadata) {
      // 嘗試從緩存鍵中提取信息
      // 假設鍵格式可能是 "portfolio:{chain}:{chainId}:{address}:..."
      const keyParts = event.key.split(':');
      if (keyParts.length >= 4 && keyParts[0] === 'portfolio') {
        const [_, chain, chainIdStr, address] = keyParts;
        const chainId = parseInt(chainIdStr, 10);

        // 檢查鏈和鏈ID是否匹配
        if (subscription.chain && (subscription.chain as string) !== chain) {
          return false;
        }

        if (subscription.chainId && subscription.chainId !== chainId) {
          return false;
        }

        // 檢查地址是否匹配（如果指定）
        if (subscription.address && subscription.address !== address) {
          return false;
        }

        // 檢查模式是否匹配（如果指定）
        if (subscription.pattern && !event.key.includes(subscription.pattern)) {
          return false;
        }

        return true;
      }

      // 如果無法從鍵中提取信息，且有指定過濾條件，則不匹配
      return !(subscription.chain || subscription.chainId || subscription.address);
    }

    // 使用事件元數據進行匹配
    const metadata = event.metadata;

    // 檢查鏈是否匹配
    if (subscription.chain && metadata.chain !== subscription.chain) {
      return false;
    }

    // 檢查鏈ID是否匹配
    if (subscription.chainId && metadata.chainId !== subscription.chainId) {
      return false;
    }

    // 檢查地址是否匹配
    if (subscription.address && metadata.address !== subscription.address) {
      return false;
    }

    // 檢查模式是否匹配
    if (subscription.pattern && !event.key.includes(subscription.pattern)) {
      return false;
    }

    return true;
  }

  /**
   * 檢查消息事件數據是否匹配訂閱條件
   */
  private matchesSubscriptionMessage(eventData: any, subscription: AddressSubscription): boolean {
    if (!eventData || !eventData.key) {
      return false;
    }

    // 嘗試從緩存鍵中提取信息
    // 假設鍵格式可能是 "portfolio:{chain}:{chainId}:{address}:..."
    const keyParts = eventData.key.split(':');
    if (keyParts.length >= 4 && keyParts[0] === 'portfolio') {
      const [_, chain, chainIdStr, address] = keyParts;
      const chainId = parseInt(chainIdStr, 10);

      // 檢查鏈和鏈ID是否匹配
      if (subscription.chain && (subscription.chain as string) !== chain) {
        return false;
      }

      if (subscription.chainId && subscription.chainId !== chainId) {
        return false;
      }

      // 檢查地址是否匹配（如果指定）
      if (subscription.address && subscription.address !== address) {
        return false;
      }

      // 檢查模式是否匹配（如果指定）
      if (subscription.pattern && !eventData.key.includes(subscription.pattern)) {
        return false;
      }

      return true;
    }

    // 如果無法從鍵中提取信息，且有指定過濾條件，則不匹配
    return !(subscription.chain || subscription.chainId || subscription.address);
  }

  /**
   * 註冊新的客戶端連接
   */
  registerClient(clientId: string, subscription?: AddressSubscription): void {
    // 如果客戶端已存在，先取消之前的註冊
    if (this.clients.has(clientId)) {
      this.unregisterClient(clientId);
    }

    const clientConnection: ClientConnection = {
      id: clientId,
      lastActive: Date.now(),
      subject: new Subject<void>(),
      isActive: true,
      subscription,
    };

    this.clients.set(clientId, clientConnection);

    if (subscription) {
      this.logger.debug(
        `客戶端 ${clientId} 已註冊，帶有訂閱過濾: chain=${subscription.chain}, chainId=${subscription.chainId}, address=${subscription.address || '*'}, 當前客戶端數: ${this.clients.size}`,
      );
    } else {
      this.logger.debug(`客戶端 ${clientId} 已註冊，當前客戶端數: ${this.clients.size}`);
    }
  }

  /**
   * 取消客戶端註冊
   */
  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client && client.isActive) {
      client.isActive = false;
      client.subject.next();
      client.subject.complete();
      this.clients.delete(clientId);
      this.logger.debug(`客戶端 ${clientId} 已取消註冊，當前客戶端數: ${this.clients.size}`);
    }
  }

  /**
   * 更新客戶端活躍時間
   */
  updateClientActivity(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client && client.isActive) {
      client.lastActive = Date.now();
      this.logger.debug(`客戶端 ${clientId} 活躍時間已更新`);
    } else {
      this.logger.warn(`嘗試更新不存在或已失效的客戶端 ${clientId} 活躍時間`);
    }
  }

  /**
   * 檢查並清理超時的客戶端
   */
  private checkClientTimeouts(): void {
    try {
      const now = Date.now();
      const timeoutThreshold = now - CLIENT_TIMEOUT;

      let timeoutCount = 0;
      for (const [clientId, client] of this.clients.entries()) {
        if (client.isActive && client.lastActive < timeoutThreshold) {
          this.logger.debug(`客戶端 ${clientId} 超過 ${CLIENT_TIMEOUT}ms 無回應，自動斷開連接`);
          client.isActive = false;
          client.subject.next();
          client.subject.complete();
          this.clients.delete(clientId);
          timeoutCount++;
        }
      }

      if (timeoutCount > 0) {
        this.logger.log(`已清理 ${timeoutCount} 個超時客戶端，剩餘 ${this.clients.size} 個連接`);
      }
    } catch (error) {
      this.logger.error(`檢查客戶端超時時出錯: ${error.message}`);
    }
  }

  /**
   * 發布快取失效事件 (本地發布，移除Redis發布)
   */
  async publishCacheInvalidation(
    key: string,
    pattern?: string,
    metadata?: { chain?: ChainName; chainId?: number; address?: string },
  ): Promise<void> {
    try {
      const event: CacheInvalidateEvent = {
        key,
        pattern,
        timestamp: Date.now(),
        id: `c-${uuidv4()}`, // c- 前綴表示這是快取事件
        metadata,
      };

      // 保存事件用於回溯
      this.storeEvent(event);

      // 本地發布
      this.eventEmitter.emit(CacheEventType.INVALIDATE, event);
      this.logger.debug(`已發布本地快取失效事件: ${key}, ID: ${event.id}`);
    } catch (error) {
      this.logger.error(`發布快取失效事件失敗: ${error.message}`);
    }
  }

  /**
   * 獲取當前活躍連接數
   */
  getActiveConnections(): number {
    return this.activeConnections;
  }

  /**
   * 處理來自 EventEmitter 的快取失效事件
   */
  @OnEvent(CacheEventType.INVALIDATE)
  handleCacheInvalidation(event: CacheInvalidateEvent): void {
    try {
      // 已透過 Observable 處理，這裡只需記錄
      this.logger.debug(
        `處理快取失效事件: ${event.key}, ID: ${event.id}, 客戶端數: ${this.clients.size}`,
      );

      // 確保事件被存儲
      this.storeEvent(event);

      // 檢查有多少客戶端可能接收此事件
      let possibleRecipients = 0;
      for (const [clientId, client] of this.clients.entries()) {
        if (client.isActive) {
          possibleRecipients++;
        }
      }

      if (possibleRecipients === 0) {
        this.logger.warn(`沒有活躍客戶端可接收快取失效事件: ${event.key}`);
      } else {
        this.logger.debug(
          `有 ${possibleRecipients} 個活躍客戶端可能接收快取失效事件: ${event.key}`,
        );
      }
    } catch (error) {
      this.logger.error(`處理快取失效事件時出錯: ${error.message}, 事件鍵: ${event.key}`);
    }
  }

  /**
   * 監聽 NotificationService 發出的地址快取失效事件
   */
  @OnEvent(CacheInvalidationEventType.ADDRESS_CACHE_INVALIDATED)
  async handleAddressCacheInvalidated(event: AddressCacheInvalidatedEvent): Promise<void> {
    try {
      this.logger.log(
        `====== 收到地址快取失效事件 ======\n` +
          `鏈: ${event.chain}\n` +
          `鏈ID: ${event.chainId}\n` +
          `地址: ${event.address}\n` +
          `緩存鍵: ${event.cacheKey}\n` +
          `緩存模式: ${event.cachePattern}\n` +
          `時間戳: ${event.timestamp}\n` +
          `活躍客戶端數: ${this.clients.size}`,
      );

      // 建立元數據用於後續過濾
      const metadata = {
        chain: event.chain,
        chainId: event.chainId,
        address: event.address,
      };

      // 轉換為 CacheInvalidateEvent 格式，並附加元數據
      try {
        await this.publishCacheInvalidation(event.cacheKey, event.cachePattern, metadata);
        this.logger.debug(`地址快取失效事件已轉換為快取事件，正在發布...`);
      } catch (pubError) {
        this.logger.error(`發布快取失效事件失敗: ${pubError.message}`, pubError.stack);
        throw pubError; // 重新拋出以便外層捕獲
      }

      // 檢查有多少客戶端會接收此事件
      let matchCount = 0;
      for (const [clientId, client] of this.clients.entries()) {
        if (client.isActive) {
          this.logger.debug(`客戶端 ${clientId} 活躍，可能接收到此事件`);
          matchCount++;
        }
      }

      this.logger.debug(
        `快取失效事件處理完成: ${event.cacheKey}，當前有 ${matchCount} 個活躍客戶端可能接收此事件`,
      );
    } catch (error) {
      this.logger.error(
        `處理地址快取失效事件失敗: ${error.message}\n事件資料: ${JSON.stringify(event)}`,
        error.stack,
      );
    }
  }

  /**
   * 創建合併後的事件 Observable
   */
  private createEventsObservable(): Observable<MessageEvent> {
    try {
      // 快取失效事件
      const invalidation$ = fromEvent<CacheInvalidateEvent>(
        this.eventEmitter,
        CacheEventType.INVALIDATE,
      ).pipe(
        map((event) => {
          this.logger.log(`Observable處理快取失效事件 (鍵: ${event.key}, ID: ${event.id})`);
          try {
            return this.formatCacheEvent(event);
          } catch (error) {
            this.logger.error(`格式化快取事件時出錯: ${error.message}`, error.stack);
            throw error;
          }
        }),
        catchError((error) => {
          this.logger.error(`處理快取失效事件時出錯: ${error.message}`);
          return of({ data: 'Error processing event' } as MessageEvent);
        }),
      );

      // 合併所有事件流並共享
      return invalidation$.pipe(
        shareReplay({ bufferSize: 1, refCount: true }),
        takeUntil(this.destroy$),
        catchError((error) => {
          this.logger.error(`事件流處理出錯: ${error.message}`);
          return of({ data: 'Error in event stream' } as MessageEvent);
        }),
      );
    } catch (error) {
      this.logger.error(`創建事件 Observable 失敗: ${error.message}`);
      return of({ data: 'Fatal error in event stream setup' } as MessageEvent);
    }
  }

  /**
   * 格式化快取事件為 SSE 格式
   */
  private formatCacheEvent(event: CacheInvalidateEvent): MessageEvent {
    return {
      type: CacheEventType.INVALIDATE,
      id: event.id,
      data: JSON.stringify({
        key: event.key,
        pattern: event.pattern,
        timestamp: event.timestamp,
        metadata: event.metadata,
      }),
    };
  }

  /**
   * 存儲事件用於回溯重放
   */
  private storeEvent(event: CacheInvalidateEvent): void {
    this.recentEvents.push(event);

    // 只保留最近 N 個事件
    if (this.recentEvents.length > MAX_STORED_EVENTS) {
      this.recentEvents.shift();
    }
  }

  /**
   * 獲取特定事件 ID 之後的所有事件
   */
  private getEventsSince(eventId: string): CacheInvalidateEvent[] {
    try {
      const index = this.recentEvents.findIndex((event) => event.id === eventId);

      if (index === -1) {
        // 找不到指定 ID，返回所有可用事件
        return [...this.recentEvents];
      }

      // 返回指定 ID 之後的所有事件
      return this.recentEvents.slice(index + 1);
    } catch (error) {
      this.logger.error(`獲取事件歷史記錄失敗: ${error.message}`);
      return [];
    }
  }
}
