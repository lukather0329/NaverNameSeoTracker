import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { config } from "./config.js";

// API 계정의 clientSecret / accessLicense / secretKey를 저장 전 암호화하기 위한 헬퍼.
// AES-256-GCM + 임의 IV. 값 앞에 버전 프리픽스를 붙여, 이 프리픽스가 없는 값은
// (도입 이전에 저장된) 레거시 평문으로 간주하고 그대로 반환한다 — 기존 데이터가
// 깨지지 않도록 하는 하위 호환 처리다. 계정을 다시 저장(수정)하면 자동으로 암호화된다.

const ALGORITHM = "aes-256-gcm";
const ENCODING_PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  if (!config.encryptionSecret) {
    throw new Error(
      "ENCRYPTION_SECRET이 설정되지 않았습니다. .env에 ENCRYPTION_SECRET 값을 추가한 뒤 서버를 다시 시작하세요."
    );
  }

  cachedKey = scryptSync(config.encryptionSecret, "naver-seo-tracker:api-account-secret", 32);
  return cachedKey;
}

export function encryptSecret(plainText: string | null | undefined): string | null {
  if (plainText === null || plainText === undefined || plainText === "") {
    return null;
  }

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return ENCODING_PREFIX + Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (!value.startsWith(ENCODING_PREFIX)) {
    // 레거시 평문 (암호화 도입 이전 데이터). 그대로 반환한다.
    return value;
  }

  try {
    const key = getKey();
    const raw = Buffer.from(value.slice(ENCODING_PREFIX.length), "base64");
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    // 복호화 실패(예: ENCRYPTION_SECRET이 바뀜) — 값을 잃어버리지 않도록 null 대신
    // 호출부에서 안전하게 처리할 수 있게 null을 반환한다.
    return null;
  }
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENCODING_PREFIX);
}
