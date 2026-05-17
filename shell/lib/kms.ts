import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";

const client = new KMSClient({ region: process.env["AWS_REGION"] });

export async function kmsEncrypt(plaintext: string): Promise<string> {
  const keyId = process.env["KMS_KEY_ID"];
  if (!keyId) throw new Error("KMS_KEY_ID env var is not set");
  const { CiphertextBlob } = await client.send(
    new EncryptCommand({ KeyId: keyId, Plaintext: Buffer.from(plaintext) })
  );
  return Buffer.from(CiphertextBlob!).toString("base64");
}

export async function kmsDecrypt(ciphertext: string): Promise<string> {
  const { Plaintext } = await client.send(
    new DecryptCommand({ CiphertextBlob: Buffer.from(ciphertext, "base64") })
  );
  return Buffer.from(Plaintext!).toString("utf-8");
}
