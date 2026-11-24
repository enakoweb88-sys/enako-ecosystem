import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VaultCodeDto, VaultConfigDto } from './vault.dto';

describe('vault request validation', () => {
  it('accepts bounded key/value rows and rejects malformed or oversized payloads', async () => {
    const valid = { environment: 'production', version: 0, rows: [{ key: 'API_KEY', value: 'fixture-value' }] };
    expect(await validate(plainToInstance(VaultConfigDto, valid))).toHaveLength(0);
    for (const value of [
      { ...valid, environment: 'unknown' },
      { ...valid, version: -1 },
      { ...valid, rows: [{ key: 'bad key', value: 'fixture' }] },
      { ...valid, rows: [{ key: 'PASSWORD', value: 'x'.repeat(16385) }] },
      { ...valid, rows: Array.from({ length: 101 }, (_, n) => ({ key: `KEY_${n}`, value: '' })) },
    ]) expect((await validate(plainToInstance(VaultConfigDto, value))).length).toBeGreaterThan(0);
  });
  it('requires a six-digit code', async () => {
    expect(await validate(plainToInstance(VaultCodeDto, { code: '123456' }))).toHaveLength(0);
    for (const code of ['12345', '1234567', 'abcdef', 123456]) {
      expect((await validate(plainToInstance(VaultCodeDto, { code }))).length).toBeGreaterThan(0);
    }
  });
});
