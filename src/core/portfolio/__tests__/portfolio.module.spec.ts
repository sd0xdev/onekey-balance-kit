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
