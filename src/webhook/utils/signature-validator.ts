import * as crypto from 'crypto';

/**
 * 驗證來自Alchemy的webhook簽名
 *
 * @param signature 請求頭中的簽名
 * @param payload 原始請求內容
 * @param webhookSecret webhook密鑰
 * @returns 驗證是否通過
 */
export function validateAlchemySignature(
  signature: string,
  payload: string,
  webhookSecret: string,
): boolean {
  if (!signature || !webhookSecret) {
    return false;
  }

  // Alchemy使用HMAC-SHA256算法簽名
  const computedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  // 進行簽名比對，注意Alchemy可能會在簽名前添加前綴
  const signatureWithoutPrefix = signature.startsWith('sha256=')
    ? signature.substring(7)
    : signature;

  // 使用安全的時間恆定比較防止計時攻擊
  return crypto.timingSafeEqual(
    Buffer.from(signatureWithoutPrefix),
    Buffer.from(computedSignature),
  );
}
