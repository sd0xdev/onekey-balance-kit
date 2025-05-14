import { StandardChainType } from '../blockchain/blockchain.constants';

export const RPC_PROVIDER = 'RPC_PROVIDER';

// 定義 RPC 提供者標識
export enum RpcProviderType {
  BASIC = 'basic',
  PREMIUM = 'premium',
  FALLBACK = 'fallback',
}

// 定義默認的 RPC 端點
export const DEFAULT_RPC_ENDPOINTS = {
  [StandardChainType.ETHEREUM]: {
    mainnet: 'https://eth-mainnet.public.blastapi.io',
    testnet: 'https://eth-sepolia.public.blastapi.io',
  },
  [StandardChainType.SOLANA]: {
    mainnet: 'https://api.mainnet-beta.solana.com',
    testnet: 'https://api.devnet.solana.com',
  },
  [StandardChainType.POLYGON]: {
    mainnet: 'https://polygon-rpc.com',
    testnet: 'https://rpc-mumbai.maticvigil.com',
  },
};
