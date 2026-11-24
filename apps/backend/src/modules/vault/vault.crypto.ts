import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

export function vaultDigest(key: Buffer, value: string) {
  return createHmac('sha256', key).update(value).digest('hex');
}
export function encryptVault(key: Buffer, context: string, value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}
export function decryptVault(key: Buffer, context: string, value: string) {
  const [version, iv, tag, data] = value.split('.');
  if (version !== 'v1') throw new Error('Unsupported vault encryption');
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data, 'base64')), cipher.final()]).toString('utf8'));
}
