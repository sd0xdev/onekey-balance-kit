import { Test } from '@nestjs/testing';
import { PortfolioModule } from '../portfolio.module';
import { PortfolioMongoListener } from '../portfolio-mongo.listener';
import { DbModule } from '../../db/db.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

describe('PortfolioModule', () => {
  it('應該編譯 portfolio 模組', async () => {
    const module = await Test.createTestingModule({
      imports: [PortfolioModule],
    }).compile();

    expect(module).toBeDefined();
  });

  it('應該正確導出依賴模組', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [PortfolioModule],
    }).compile();

    // 檢查模組是否包含預期的提供者
    const portfolioListener = moduleFixture.get<PortfolioMongoListener>(PortfolioMongoListener);
    expect(portfolioListener).toBeDefined();

    // 檢查模組依賴
    const moduleRef = moduleFixture.get(PortfolioModule);
    expect(moduleRef).toBeDefined();

    // 確認 module metadata
    const metadata = Reflect.getMetadata('imports', PortfolioModule);
    expect(metadata).toBeDefined();
    expect(metadata).toContain(DbModule);

    // 確認使用了 EventEmitterModule
    const foundEventEmitter = metadata.some(
      (imported) =>
        imported === EventEmitterModule ||
        (typeof imported === 'object' && imported.module === EventEmitterModule),
    );
    expect(foundEventEmitter).toBeTruthy();
  });
});
