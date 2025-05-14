export enum SupportedChainType {
  ETH = 'eth',
  SOL = 'sol',
}

export interface ChainInfo {
  id: number;
  name: string;
  type: SupportedChainType;
}

export const SUPPORTED_CHAINS: ChainInfo[] = [
  {
    id: 1,
    name: 'Ethereum',
    type: SupportedChainType.ETH,
  },
  {
    id: 101,
    name: 'Solana',
    type: SupportedChainType.SOL,
  },
];

export const CHAIN_INFO_MAP = SUPPORTED_CHAINS.reduce(
  (map, chainInfo) => {
    map[chainInfo.type] = chainInfo;
    return map;
  },
  {} as Record<SupportedChainType, ChainInfo>,
);
