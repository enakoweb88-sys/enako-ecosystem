// Disposable loopback PostgreSQL only; never consumes deployment DB URLs or contacts live services.
require('./register-typescript.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
// Nest's ConfigService prioritizes process.env. Keep fixtures isolated from any
// variables the generated Prisma runtime may discover while loading its client.
class ConfigService {
  constructor(values = {}) { this.values = values; }
  get(key) { return this.values[key]; }
}
const { Client } = require('pg');
const { localPostgres } = require('./local-postgres.cjs');
const { VaultService } = require('../src/modules/vault/vault.service.ts');

(async () => {
  const instance = await localPostgres();
  const db = new PrismaClient({ datasources: { db: { url: instance.url } } });
  const sql = new Client({ connectionString: instance.url });
  let passed = 0;
  const test = async (name, fn) => { await fn(); console.log('PASS ' + name); passed++; };
  try {
    await sql.connect();
    await sql.query('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE enako_runtime;');
    for (const folder of fs.readdirSync(path.resolve(__dirname, '../prisma/migrations')).sort()) {
      const file = path.resolve(__dirname, '../prisma/migrations', folder, 'migration.sql');
      if (fs.existsSync(file)) await sql.query(fs.readFileSync(file, 'utf8'));
    }
    const role = await db.role.create({ data: { name: 'CEO' } });
    const person = await db.user.create({ data: { email: 'owner@fixture.invalid', fullName: 'Fixture Owner', passwordHash: 'unused', roleId: role.id } });
    const first = await db.authSession.create({ data: { userId: person.id, roleAtIssue: 'CEO', expiresAt: new Date(Date.now() + 3600000) } });
    const second = await db.authSession.create({ data: { userId: person.id, roleAtIssue: 'CEO', expiresAt: new Date(Date.now() + 3600000) } });
    const user = { sub: person.id, email: person.email, sid: first.id, role: 'CEO' };
    const otherSession = { ...user, sid: second.id };
    const settings = new ConfigService({ VAULT_OWNER_EMAIL: person.email, VAULT_ENCRYPTION_KEY: randomBytes(32).toString('hex') });
    let delivered;
    const mail = { sendEmail: async options => { delivered = options; return { success: true }; } };
    const vault = new VaultService(db, settings, mail);
    let code, token, platform;
    const requestCode = async () => { await db.$executeRaw`UPDATE vault_access SET "requestedAt" = NOW() - INTERVAL '2 minutes'`; await vault.requestCode(user); code = delivered.text.match(/code is (\d{6})/)[1]; };
    await test('unconfigured vault and non-engineering accounts fail closed', async () => {
      await assert.rejects(new VaultService(db, new ConfigService({}), mail).requestCode(user));
      await assert.rejects(vault.requestCode({ ...user, sub: 'not-owner', email: 'not-owner@fixture.invalid' }));
      await assert.rejects(vault.platforms(user));
    });
    await test('fixed email delivery, hashes, cooldown, single-use code and session binding', async () => {
      await requestCode();
      assert.equal(delivered.to, person.email); assert.equal(delivered.exactRecipient, true);
      const record = (await db.$queryRaw`SELECT * FROM vault_access`)[0];
      assert.notEqual(record.codeHash, code);
      await assert.rejects(vault.requestCode(otherSession));
      await assert.rejects(vault.verify(otherSession, code));
      token = (await vault.verify(user, code)).token;
      await assert.rejects(vault.verify(user, code));
      await assert.rejects(vault.platforms(otherSession, token));
    });
    await test('platform credentials encrypted at rest, environments isolated, stale writes rejected', async () => {
      platform = await vault.createPlatform(user, token, 'Render');
      await assert.rejects(vault.createPlatform(user, token, 'render'));
      const rows = [{ key: 'PASSWORD', value: 'fixture-sensitive-password' }, { key: 'SERVICE_URL', value: 'https://fixture.invalid' }];
      await vault.save(user, token, platform.id, { environment: 'production', version: 0, rows });
      const stored = (await db.$queryRaw`SELECT ciphertext FROM vault_configs`)[0].ciphertext;
      assert.ok(!stored.includes(rows[0].value));
      assert.deepEqual((await vault.read(user, token, platform.id, 'production')).rows, rows);
      assert.deepEqual((await vault.read(user, token, platform.id, 'staging')).rows, []);
      await assert.rejects(vault.save(user, token, platform.id, { environment: 'production', version: 0, rows }));
      await vault.save(user, token, platform.id, { environment: 'production', version: 1, rows: [] });
      assert.deepEqual((await vault.read(user, token, platform.id, 'production')).rows, []);
      const logs = await db.auditLog.findMany({ where: { entity: 'credential_vault' } });
      assert.ok(logs.some(log => log.action === 'VAULT_CREDENTIALS_READ'));
      assert.ok(!JSON.stringify(logs).includes(rows[0].value));
    });
    await test('five wrong guesses persist and exhaust the challenge; expired codes fail', async () => {
      await requestCode();
      for (let i = 0; i < 5; i++) await assert.rejects(vault.verify(user, code === '111111' ? '222222' : '111111'));
      await assert.rejects(vault.verify(user, code));
      assert.equal((await db.$queryRaw`SELECT attempts FROM vault_access WHERE "sessionId" = ${user.sid}`)[0].attempts, 5);
      await requestCode();
      await db.$executeRaw`UPDATE vault_access SET "expiresAt" = NOW() - INTERVAL '1 second'`;
      await assert.rejects(vault.verify(user, code));
    });
    await test('concurrent code verification unlocks exactly once', async () => {
      await requestCode();
      const results = await Promise.allSettled([vault.verify(user, code), vault.verify(user, code)]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    });
    await test('lock and expiry revoke reads and writes; deletion cascades', async () => {
      await requestCode(); token = (await vault.verify(user, code)).token;
      await vault.lock(user); await assert.rejects(vault.platforms(user, token));
      await assert.rejects(vault.save(user, token, platform.id, { environment: 'production', version: 2, rows: [] }));
      await requestCode(); token = (await vault.verify(user, code)).token;
      await db.$executeRaw`UPDATE vault_access SET "unlockedUntil" = NOW() - INTERVAL '1 second'`;
      await assert.rejects(vault.platforms(user, token));
      await requestCode(); token = (await vault.verify(user, code)).token;
      await vault.deletePlatform(user, token, platform.id);
      assert.equal((await db.$queryRaw`SELECT * FROM vault_configs`).length, 0);
    });
    await test('browser roles cannot access tables, backend role has RLS policy', async () => {
      for (const role of ['anon', 'authenticated']) {
        await sql.query('SET ROLE ' + role);
        for (const table of ['vault_access', 'vault_platforms', 'vault_configs']) await assert.rejects(sql.query('SELECT * FROM ' + table));
        await sql.query('RESET ROLE');
      }
      await sql.query('SET ROLE enako_runtime');
      assert.equal((await sql.query('SELECT * FROM vault_access')).rows.length, 1);
      await sql.query('RESET ROLE');
    });
    await test('failed email delivery never leaves a usable code', async () => {
      await db.$executeRaw`UPDATE vault_access SET "requestedAt" = NOW() - INTERVAL '2 minutes'`;
      const failed = new VaultService(db, settings, { sendEmail: async () => ({ success: false }) });
      await assert.rejects(failed.requestCode(user));
      assert.equal((await db.$queryRaw`SELECT "codeHash" FROM vault_access`)[0].codeHash, null);
    });
    console.log(`${passed} vault database checks passed`);
  } finally { await sql.end(); await db.$disconnect(); await instance.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
