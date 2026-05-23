import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface CryptoProvider {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

class KmsCryptoProvider implements CryptoProvider {
  async encrypt(plaintext: string): Promise<string> {
    const { kmsEncrypt } = await import("@/lib/kms");
    return kmsEncrypt(plaintext);
  }
  async decrypt(ciphertext: string): Promise<string> {
    const { kmsDecrypt } = await import("@/lib/kms");
    return kmsDecrypt(ciphertext);
  }
}

class LocalCryptoProvider implements CryptoProvider {
  private getKey(): Buffer {
    const hex = process.env["ENCRYPTION_KEY"];
    if (!hex || hex.length !== 64) {
      throw new Error("ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
    }
    return Buffer.from(hex, "hex");
  }

  async encrypt(plaintext: string): Promise<string> {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `local:${iv.toString("hex")}:${ct.toString("hex")}:${tag.toString("hex")}`;
  }

  async decrypt(ciphertext: string): Promise<string> {
    const parts = ciphertext.split(":");
    if (parts.length !== 4 || parts[0] !== "local") {
      throw new Error("Invalid local ciphertext format");
    }
    const [, ivHex, ctHex, tagHex] = parts as [string, string, string, string];
    const key = this.getKey();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ctHex, "hex")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }
}

function getProvider(): CryptoProvider {
  const provider = process.env["ENCRYPTION_PROVIDER"];
  const hasKms = !!process.env["KMS_KEY_ID"];
  const hasLocal = !!process.env["ENCRYPTION_KEY"];

  if (provider === "kms" || (!provider && hasKms)) {
    return new KmsCryptoProvider();
  }
  if (provider === "local" || (!provider && hasLocal)) {
    return new LocalCryptoProvider();
  }
  throw new Error(
    "No encryption provider configured. Set ENCRYPTION_KEY (local) or KMS_KEY_ID + ENCRYPTION_PROVIDER=kms."
  );
}

let _provider: CryptoProvider | null = null;

function provider(): CryptoProvider {
  if (!_provider) _provider = getProvider();
  return _provider;
}

export function encrypt(plaintext: string): Promise<string> {
  return provider().encrypt(plaintext);
}

export function decrypt(ciphertext: string): Promise<string> {
  return provider().decrypt(ciphertext);
}
