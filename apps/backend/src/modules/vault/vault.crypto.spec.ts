import { randomBytes } from 'crypto';
import { decryptVault, encryptVault, vaultDigest } from './vault.crypto';

describe('vault encryption', () => {
  const key = randomBytes(32);
  it('encrypts values with fresh nonces and binds them to their platform and environment', () => {
    const rows = [{ key: 'PASSWORD', value: 'fixture-sensitive-value' }];
    const first = encryptVault(key, 'render:production', rows);
    expect(first).not.toContain(rows[0].value);
    expect(encryptVault(key, 'render:production', rows)).not.toBe(first);
    expect(decryptVault(key, 'render:production', first)).toEqual(rows);
    expect(() => decryptVault(key, 'render:staging', first)).toThrow();
    expect(() => decryptVault(randomBytes(32), 'render:production', first)).toThrow();
    const parts = first.split('.');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => decryptVault(key, 'render:production', parts.join('.'))).toThrow();
  });
  it('does not store raw codes or unlock tokens', () => {
    expect(vaultDigest(key, 'session:123456')).toMatch(/^[a-f0-9]{64}$/);
    expect(vaultDigest(key, 'session:123456')).not.toBe(vaultDigest(key, 'other:123456'));
  });
});
