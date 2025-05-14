import { Module } from '@nestjs/common';
import { RpcService } from './rpc.service';
import { ConfigModule } from '@nestjs/config';
import { RpcProviderFactory } from './rpc-provider.factory';
import { SolanaRpcProvider } from './solana-rpc.provider';

@Module({
  imports: [ConfigModule],
  providers: [RpcService, RpcProviderFactory, SolanaRpcProvider],
  exports: [RpcService, RpcProviderFactory],
})
export class RpcModule {}
