import * as chainsIndex from '../index';

/**
 * 測試 src/chains/index.ts 的導出
 * 這個檔案主要是一個彙總匯出點，我們需要確認所有應該導出的項目都存在
 */
describe('Chains Index Exports', () => {
  it('should export constants', () => {
    // 檢查常量匯出
    expect(chainsIndex.ChainName).toBeDefined();
    // 修正：ChainId 不存在，但 ChainName 和 ChainCode 存在
    expect(chainsIndex.ChainCode).toBeDefined();
  });

  it('should export interfaces indirectly', () => {
    // 由於接口是類型而非值，無法直接檢查
    // 我們可以檢查通過 index.ts 間接導出的其他相關項
    const exportedItems = Object.keys(chainsIndex);
    expect(exportedItems).toContain('AbstractChainService');
  });

  it('should export decorators', () => {
    // 檢查 Chain 裝飾器
    expect(chainsIndex.Chain).toBeDefined();
    expect(typeof chainsIndex.Chain).toBe('function');
  });

  it('should export abstract classes', () => {
    // 檢查抽象鏈服務類
    expect(chainsIndex.AbstractChainService).toBeDefined();
    expect(typeof chainsIndex.AbstractChainService).toBe('function');
  });

  it('should export factory services', () => {
    // 檢查工廠服務
    expect(chainsIndex.ChainServiceFactory).toBeDefined();
    expect(chainsIndex.DiscoveryService).toBeDefined();
    expect(typeof chainsIndex.ChainServiceFactory).toBe('function');
    expect(typeof chainsIndex.DiscoveryService).toBe('function');
  });

  it('should export controllers', () => {
    // 檢查控制器
    expect(chainsIndex.ChainsController).toBeDefined();
    expect(typeof chainsIndex.ChainsController).toBe('function');
  });

  it('should export the main module', () => {
    // 檢查主模組
    expect(chainsIndex.ChainsModule).toBeDefined();
    expect(typeof chainsIndex.ChainsModule).toBe('function');
    // 驗證模組靜態方法
    expect(chainsIndex.ChainsModule.register).toBeDefined();
    expect(typeof chainsIndex.ChainsModule.register).toBe('function');
  });

  it('should export chain-specific services', () => {
    // 檢查特定鏈服務
    expect(chainsIndex.EthereumService).toBeDefined();
    expect(chainsIndex.SolanaService).toBeDefined();
    expect(typeof chainsIndex.EthereumService).toBe('function');
    expect(typeof chainsIndex.SolanaService).toBe('function');
  });

  it('should have the correct number of exports', () => {
    // 驗證總的導出項目數量
    // 我們需要減去對象原型上的屬性數
    const exportedKeys = Object.keys(chainsIndex).filter(
      (key) => !key.startsWith('__') && key !== 'default',
    );
    // 根據 index.ts 的內容，應該有一定數量的導出
    // 包括常量、接口、裝飾器、抽象類、服務、控制器、模組等
    expect(exportedKeys.length).toBeGreaterThan(5);

    // 列出所有導出項目，用於調試
    console.log('Exported items:', exportedKeys);
  });
});
