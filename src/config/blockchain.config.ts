import { registerAs } from '@nestjs/config';

/**
 * 區塊鏈配置
 */
export default registerAs('blockchain', () => ({
  /**
   * 默認區塊鏈提供者
   */
  defaultProvider: process.env.DEFAULT_BLOCKCHAIN_PROVIDER || 'alchemy',

  /**
   * 啟用的EVM鏈列表
   * 格式: ETH,POLY,BSC
   */
  enabledChains: process.env.ENABLE_CHAINS?.split(',') || ['ETH'],

  /**
   * 區塊鏈提供者配置
   */
  providers: {
    /**
     * Alchemy 配置
     */
    alchemy: {
      apiKey: process.env.ALCHEMY_API_KEY || '',
      baseUrl: process.env.ALCHEMY_BASE_URL || 'https://eth-mainnet.g.alchemy.com/v2/',
    },

    /**
     * QuickNode 配置
     */
    quicknode: {
      apiKey: process.env.QUICKNODE_API_KEY || '',
      baseUrl: process.env.QUICKNODE_BASE_URL || 'https://api.quicknode.com/',
    },

    /**
     * Infura 配置
     */
    infura: {
      apiKey: process.env.INFURA_API_KEY || '',
      baseUrl: process.env.INFURA_BASE_URL || 'https://mainnet.infura.io/v3/',
    },
  },
}));
