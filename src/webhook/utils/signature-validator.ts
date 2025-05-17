import * as crypto from 'crypto';

/**
 * 驗證來自Alchemy的webhook簽名
 *
 * @param signatureHeader 請求頭中的簽名
 * @param rawBody 原始請求內容
 * @param signingKey webhook密鑰
 * @returns 驗證是否通過
 */
export function validateAlchemySignature(
  signatureHeader: string,
  rawBody: Buffer,
  signingKey: string,
): boolean {
  if (!signatureHeader || !signingKey || !rawBody) return false;

  // 1. 處理前綴並統一為小寫 64-byte hex
  const remoteSig = signatureHeader
    .replace(/^sha256=|^0x/i, '') // 去掉 "sha256=" 或 "0x"
    .trim()
    .toLowerCase();

  if (remoteSig.length !== 64) return false; // 不是有效 SHA-256 hex

  // 2. 用「原始位元組」計算 HMAC-SHA256
  const localSig = crypto
    .createHmac('sha256', signingKey)
    .update(rawBody) // **必須是 Buffer，不要 JSON.stringify**
    .digest('hex');

  // 3. 轉 hex → Buffer 後做 constant-time 比對
  return crypto.timingSafeEqual(Buffer.from(remoteSig, 'hex'), Buffer.from(localSig, 'hex'));
}
