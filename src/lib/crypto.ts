/**
 * Mã hóa PII (CCCD) ở tầng server trước khi ghi xuống DB.
 *
 * - Thuật toán: AES-256-GCM (vừa mã hóa vừa xác thực toàn vẹn dữ liệu).
 * - Mỗi bản ghi dùng IV ngẫu nhiên 12 byte => cùng một CCCD sẽ cho ciphertext
 *   khác nhau, chống phân tích tần suất.
 * - Kèm "blind index" HMAC-SHA256 để tra cứu chính xác CCCD (dùng khi OCR
 *   check-in) mà không phải giải mã / quét toàn bộ bảng.
 *
 * Khóa được nạp từ biến môi trường (xem .env.example):
 *   PII_ENCRYPTION_KEY   : 32 byte base64 - khóa AES
 *   PII_BLIND_INDEX_KEY  : 32 byte base64 - khóa HMAC
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

export type EncryptedPii = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export type EncryptedCccd = EncryptedPii & {
  /** Blind index dùng để matching, lưu vào User.cccdHash */
  hash: string;
};

function loadKey(envName: string): Buffer {
  const raw = process.env[envName];
  if (!raw) {
    throw new Error(
      `Thiếu biến môi trường ${envName}. Xem hướng dẫn trong .env.example.`,
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `${envName} phải là ${KEY_BYTES} byte dạng base64 (nhận được ${key.length} byte).`,
    );
  }

  return key;
}

/**
 * Chuẩn hóa CCCD: bỏ khoảng trắng, dấu gạch, dấu chấm.
 * CCCD Việt Nam gồm đúng 12 chữ số.
 */
export function normalizeCccd(input: string): string {
  const normalized = input.replace(/[\s.-]/g, "");

  if (!/^\d{12}$/.test(normalized)) {
    throw new Error("CCCD không hợp lệ: phải gồm đúng 12 chữ số.");
  }

  return normalized;
}

/** Mã hóa một chuỗi PII bất kỳ bằng AES-256-GCM. */
export function encryptPii(plaintext: string): EncryptedPii {
  const key = loadKey("PII_ENCRYPTION_KEY");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

/** Giải mã dữ liệu đã mã hóa bằng encryptPii. */
export function decryptPii(payload: EncryptedPii): string {
  const key = loadKey("PII_ENCRYPTION_KEY");
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, "base64"),
    { authTagLength: AUTH_TAG_BYTES },
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

/**
 * Blind index: HMAC-SHA256 của giá trị đã chuẩn hóa.
 * Deterministic để có thể query `where: { cccdHash }` khi OCR.
 */
export function blindIndex(value: string): string {
  const key = loadKey("PII_BLIND_INDEX_KEY");
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

/**
 * Chuẩn bị dữ liệu CCCD để ghi vào User:
 *   cccdCiphertext / cccdIv / cccdAuthTag / cccdHash
 */
export function encryptCccd(cccd: string): EncryptedCccd {
  const normalized = normalizeCccd(cccd);
  const encrypted = encryptPii(normalized);

  return {
    ...encrypted,
    hash: blindIndex(normalized),
  };
}

/** Giải mã CCCD từ một bản ghi User. Trả null nếu chưa có CCCD. */
export function decryptCccd(record: {
  cccdCiphertext: string | null;
  cccdIv: string | null;
  cccdAuthTag: string | null;
}): string | null {
  if (!record.cccdCiphertext || !record.cccdIv || !record.cccdAuthTag) {
    return null;
  }

  return decryptPii({
    ciphertext: record.cccdCiphertext,
    iv: record.cccdIv,
    authTag: record.cccdAuthTag,
  });
}

/** Che CCCD để hiển thị trên UI: 001203******12 */
export function maskCccd(cccd: string): string {
  const normalized = normalizeCccd(cccd);
  return `${normalized.slice(0, 6)}******${normalized.slice(-2)}`;
}

/** So sánh blind index theo kiểu constant-time (tránh timing attack). */
export function safeEqualHash(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
