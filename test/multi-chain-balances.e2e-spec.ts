import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('多鏈餘額查詢 (e2e)', () => {
  let app: INestApplication;

  // 測試地址 - 使用公開的測試地址
  const TEST_ADDRESS = '0x0000000000000000000000000000000000000000';

  beforeAll(async () => {
    // 設置環境變數啟用所有鏈
    process.env.ENABLE_CHAINS = 'ETH,POLY,BSC';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // 測試多鏈餘額API
  it.each([
    ['ethereum', 'ETH'],
    ['polygon', 'MATIC'],
    ['bsc', 'BNB'],
  ])('GET /v1/api/balances/%s/:address', async (chain, expectedSymbol) => {
    const response = await request(app.getHttpServer())
      .get(`/v1/api/balances/${chain}/${TEST_ADDRESS}`)
      .expect(200);

    // 驗證響應格式
    expect(response.body).toHaveProperty('nativeBalance');
    expect(response.body.nativeBalance).toHaveProperty('symbol', expectedSymbol);
    expect(response.body).toHaveProperty('fungibles');
    expect(response.body).toHaveProperty('nfts');
    expect(response.body).toHaveProperty('updatedAt');
  });
});
