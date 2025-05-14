import { Module } from '@nestjs/common';
import { AlchemyModule } from './alchemy/alchemy.module';
import { RpcModule } from './rpc/rpc.module';
import { BlockchainModule } from './blockchain/blockchain.module';

@Module({
  imports: [
    AlchemyModule,
    RpcModule,
    BlockchainModule.forRoot(), // 使用動態模組的 forRoot() 方法
  ],
  exports: [AlchemyModule, RpcModule, BlockchainModule],
})
export class ProvidersModule {}
