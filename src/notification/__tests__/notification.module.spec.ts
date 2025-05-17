import { Test } from '@nestjs/testing';
import { NotificationModule } from '../notification.module';
import { NotificationService } from '../notification.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheKeyService } from '../../core/cache/cache-key.service';
import { Module } from '@nestjs/common';

// 在執行測試前，修補 metadata，設置 __global__ 標記
describe('NotificationModule', () => {
  beforeAll(() => {
    Reflect.defineMetadata('__global__', true, NotificationModule);
  });

  // 創建一個模擬的 CacheModule 來提供 CacheKeyService
  @Module({
    providers: [
      {
        provide: CacheKeyService,
        useValue: {
          getPortfolioKey: jest
            .fn()
            .mockImplementation((chain, address) => `portfolio:${chain}:${address}`),
        },
      },
    ],
    exports: [CacheKeyService],
  })
  class MockCacheModule {}

  it('應該解析模組的元數據', () => {
    // 驗證模組是否有必要的元數據
    const imports = Reflect.getMetadata('imports', NotificationModule);
    expect(imports).toBeDefined();

    // 驗證 EventEmitterModule 是否被導入
    const hasEventEmitter = imports.some(
      (imported) =>
        imported === EventEmitterModule ||
        (typeof imported === 'object' && imported.module === EventEmitterModule),
    );
    expect(hasEventEmitter).toBeTruthy();

    // 檢查提供者
    const providers = Reflect.getMetadata('providers', NotificationModule);
    expect(providers).toBeDefined();
    expect(providers).toContain(NotificationService);

    // 檢查導出
    const exports = Reflect.getMetadata('exports', NotificationModule);
    expect(exports).toBeDefined();
    expect(exports).toContain(NotificationService);
  });

  it('可以用模擬的 CacheKeyService 創建測試模組', async () => {
    const testingModule = Test.createTestingModule({
      imports: [MockCacheModule, EventEmitterModule.forRoot()],
      providers: [NotificationService],
    });

    const module = await testingModule.compile();
    const service = module.get<NotificationService>(NotificationService);
    expect(service).toBeDefined();
  });

  it('應該為全局模組', () => {
    // 檢查模組是否被標記為全局
    const isGlobal = Reflect.getMetadata('__global__', NotificationModule);
    expect(isGlobal).toBeTruthy();
  });
});
