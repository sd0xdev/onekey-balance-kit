import * as crypto from 'crypto';
import { validateAlchemySignature } from './signature-validator';

// 模擬 crypto 模塊
jest.mock('crypto', () => {
  const originalModule = jest.requireActual('crypto');
  return {
    ...originalModule,
    createHmac: jest.fn(),
    timingSafeEqual: jest.fn(),
  };
});

describe('validateAlchemySignature', () => {
  // 測試數據
  const mockSecret = 'test-webhook-secret';
  const mockPayload = Buffer.from('{"data":"test"}');
  const mockSignature = 'sha256=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const mockComputedSignature = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    // 重置模擬函數
    jest.clearAllMocks();

    // 設置模擬函數返回值
    const hmacMock = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue(mockComputedSignature),
    };
    (crypto.createHmac as jest.Mock).mockReturnValue(hmacMock);

    // 默認設置 timingSafeEqual 為 true
    (crypto.timingSafeEqual as jest.Mock).mockReturnValue(true);
  });

  it('當簽名與計算出的簽名匹配時，應該返回 true', () => {
    // 設置 timingSafeEqual 返回 true
    (crypto.timingSafeEqual as jest.Mock).mockReturnValue(true);

    // 執行驗證
    const result = validateAlchemySignature(mockSignature, mockPayload, mockSecret);

    // 驗證結果和方法調用
    expect(result).toBe(true);
    expect(crypto.createHmac).toHaveBeenCalledWith('sha256', mockSecret);

    // 獲取 hmacMock 實例
    const hmacMock = (crypto.createHmac as jest.Mock).mock.results[0].value;
    // 使用 mockCalls 而不是直接引用方法來檢查調用
    expect(hmacMock.update).toHaveBeenCalledWith(mockPayload);
    expect(hmacMock.digest).toHaveBeenCalledWith('hex');

    expect(crypto.timingSafeEqual).toHaveBeenCalled();
  });

  it('當簽名前綴被正確處理時，應該返回 true', () => {
    // 設置 timingSafeEqual 返回 true
    (crypto.timingSafeEqual as jest.Mock).mockReturnValue(true);

    // 執行驗證
    const result = validateAlchemySignature(mockSignature, mockPayload, mockSecret);

    // 驗證結果和方法調用
    expect(result).toBe(true);
    // 確認 timingSafeEqual 被調用時正確處理了前綴
    expect(crypto.timingSafeEqual).toHaveBeenCalledWith(
      Buffer.from(mockComputedSignature, 'hex'),
      Buffer.from(mockComputedSignature, 'hex'),
    );
  });

  it('當簽名與計算出的簽名不匹配時，應該返回 false', () => {
    // 設置 timingSafeEqual 返回 false
    (crypto.timingSafeEqual as jest.Mock).mockReturnValue(false);

    // 執行驗證
    const result = validateAlchemySignature(mockSignature, mockPayload, mockSecret);

    // 驗證結果
    expect(result).toBe(false);
    expect(crypto.timingSafeEqual).toHaveBeenCalled();
  });

  it('當簽名為空時，應該返回 false', () => {
    // 執行驗證
    const result = validateAlchemySignature('', mockPayload, mockSecret);

    // 驗證結果
    expect(result).toBe(false);
    expect(crypto.createHmac).not.toHaveBeenCalled();
  });

  it('當密鑰為空時，應該返回 false', () => {
    // 執行驗證
    const result = validateAlchemySignature(mockSignature, mockPayload, '');

    // 驗證結果
    expect(result).toBe(false);
    expect(crypto.createHmac).not.toHaveBeenCalled();
  });

  it('當簽名和密鑰都為空時，應該返回 false', () => {
    // 執行驗證
    const result = validateAlchemySignature('', mockPayload, '');

    // 驗證結果
    expect(result).toBe(false);
    expect(crypto.createHmac).not.toHaveBeenCalled();
  });

  it('當簽名長度不為 64 時，應該返回 false', () => {
    // 執行驗證
    const result = validateAlchemySignature('sha256=1234', mockPayload, mockSecret);

    // 驗證結果
    expect(result).toBe(false);
    expect(crypto.createHmac).not.toHaveBeenCalled();
  });
});
