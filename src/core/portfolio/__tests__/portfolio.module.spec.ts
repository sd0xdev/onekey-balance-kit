import { Test } from '@nestjs/testing';
import { PortfolioModule } from '../portfolio.module';
import { PortfolioMongoListener } from '../portfolio-mongo.listener';
import { DbModule } from '../../db/db.module';
import { DbService } from '../../db/db.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';

// 模擬所有需要的 Model
const createMockModel = () => ({
  findOne: jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(null),
  }),
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  }),
  findOneAndUpdate: jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue({
      chain: 'ethereum',
      chainId: 1,
      address: '0x1234',
      native: { symbol: 'ETH', value: '1.0' },
      fungibles: [],
    }),
  }),
  create: jest.fn().mockResolvedValue({}),
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
});

describe('PortfolioModule', () => {
  it('應該編譯 portfolio 模組', async () => {
    const module = await Test.createTestingModule({
      imports: [
        // 使用 EventEmitterModule 替代實際導入的模組
        EventEmitterModule.forRoot(),
        PortfolioModule,
      ],
    })
      // 提供一個模擬的 Connection
      .overrideProvider('DATABASE_CONNECTION')
      .useValue({})
      // 提供模擬的 DbService
      .overrideProvider(DbService)
      .useValue({
        savePortfolioSnapshot: jest.fn().mockResolvedValue({
          chain: 'ethereum',
          chainId: 1,
          address: '0x1234',
          native: { symbol: 'ETH', value: '1.0' },
          fungibles: [],
        }),
        getPortfolioSnapshot: jest.fn().mockResolvedValue(null),
        getPortfolioHistory: jest.fn().mockResolvedValue([]),
        getConnection: jest.fn().mockReturnValue({}),
      })
      // 模擬 Model
      .overrideProvider(getModelToken('PortfolioSnapshot'))
      .useValue(createMockModel())
      .overrideProvider(getModelToken('PortfolioHistory'))
      .useValue(createMockModel())
      .overrideProvider(getModelToken('TxHistory'))
      .useValue(createMockModel())
      .overrideProvider(getModelToken('NftOwner'))
      .useValue(createMockModel())
      .overrideProvider(getModelToken('NftMeta'))
      .useValue(createMockModel())
      .overrideProvider(getModelToken('PriceCache'))
      .useValue(createMockModel())
      .overrideProvider(getModelToken('WebhookEvent'))
      .useValue(createMockModel())
      // 模擬 MongooseModule
      .overrideProvider(MongooseModule)
      .useValue({})
      .compile();

    expect(module).toBeDefined();
  }, 30000); // 單獨指定測試超時時間

  it('應該正確導出依賴模組', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        // 使用 EventEmitterModule 替代實際導入的模組
        EventEmitterModule.forRoot(),
        PortfolioModule,
      ],
    })
      // 提供一個模擬的 Connection
      .overrideProvider('DATABASE_CONNECTION')
      .useValue({})
      // 提供模擬的 DbService
      .overrideProvider(DbService)
      .useValue({
        savePortfolioSnapshot: jest.fn().mockResolvedValue({
          chain: 'ethereum',
          chainId: 1,
          address: '0x1234',
          native: { symbol: 'ETH', value: '1.0' },
          fungibles: [],
        }),
        getPortfolioSnapshot: jest.fn().mockResolvedValue(null),
        getPortfolioHistory: jest.fn().mockResolvedValue([]),
        getConnection: jest.fn().mockReturnValue({}),
      })
      // 模擬 Model
      .overrideProvider(getModelToken('PortfolioSnapshot'))
      .useValue(createMockModel())
      .overrideProvider(getModelToken('PortfolioHistory'))
      .useValue(createMockModel())
      .overrideProvider(getModelToken('TxHistory'))
      .useValue(createMockModel())
      .overrideProvider(getModelToken('NftOwner'))
      .useValue(createMockModel())
      .overrideProvider(getModelToken('NftMeta'))
      .useValue(createMockModel())
      .overrideProvider(getModelToken('PriceCache'))
      .useValue(createMockModel())
      .overrideProvider(getModelToken('WebhookEvent'))
      .useValue(createMockModel())
      // 模擬 MongooseModule
      .overrideProvider(MongooseModule)
      .useValue({})
      .compile();

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
  }, 30000); // 單獨指定測試超時時間
});
