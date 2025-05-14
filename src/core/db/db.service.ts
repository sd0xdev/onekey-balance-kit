import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class DbService {
  private readonly logger = new Logger(DbService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {
    this.logger.log('DbService initialized with Mongoose connection');
  }

  getConnection(): Connection {
    return this.connection;
  }
}
