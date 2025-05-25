import crypto from "crypto";

const algorithm = "aes-256-cbc";
const key = crypto
  .createHash("sha256")
  .update(process.env.ENCRYPTION_SECRET!) 
  .digest();
const ivLength = 16;

export function encryptPrivateKey(privateKey: string): string {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(privateKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptPrivateKey(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(':')) {
    throw new Error('Invalid data: missing iv or ciphertext');
  }
  const [ivHex, encrypted] = encryptedData.split(':');
  if (ivHex.length !== ivLength * 2) {
    throw new Error(`Invalid IV length ${ivHex.length}, expected ${ivLength * 2} hex chars`);
  }

  const iv = Buffer.from(ivHex, 'hex');
  if (iv.length !== ivLength) {
    throw new Error(`IV buffer wrong size ${iv.length}, expected ${ivLength}`);
  }

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

