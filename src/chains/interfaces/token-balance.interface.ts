/**
 * 代幣餘額介面
 * 表示用戶在特定代幣上的餘額
 */
export interface TokenBalance {
  /** 代幣地址 */
  tokenAddress: string;
  /** 代幣符號（如 ETH, USDC 等） */
  symbol: string;
  /** 代幣名稱 */
  name?: string;
  /** 代幣餘額（原始字符串格式） */
  balance: string;
  /** 代幣小數位數 */
  decimals: number;
  /** USD 價值（可選，如果無法獲取價格則為 0） */
  usdValue?: number;
}
