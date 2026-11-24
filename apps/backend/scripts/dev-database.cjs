const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { randomBytes, createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { Client } = require('pg');

// Provisioning is confined to this loopback cluster, never deployment DB URLs.
async function startDevDatabase() {
  const root = path.resolve(__dirname, '..');
  const local = path.join(root, '.local-dev');
  fs.mkdirSync(local, { recursive: true });
  const stateFile = path.join(local, 'state.json');
  let state;
  if (fs.existsSync(stateFile)) state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  else {
    const socket = net.createServer();
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const secret = () => randomBytes(48).toString('hex');
    state = { version: 1, port, adminPassword: secret(), runtimePassword: secret(), password: randomBytes(18).toString('base64url'), access: secret(), refresh: secret(), cash: secret(), limiter: secret(), vault: randomBytes(32).toString('hex') };
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' });
  }
  if (state.version !== 1 || !Number.isInteger(state.port) || state.port < 1024 || state.port > 65535 || !/^[a-f0-9]{96}$/.test(state.adminPassword) || !/^[a-f0-9]{96}$/.test(state.runtimePassword)) throw new Error('Invalid local database state');
  const adminUrl = `postgresql://enako_dev_admin:${state.adminPassword}@127.0.0.1:${state.port}/postgres`;
  const runtimeUrl = `postgresql://enako_runtime:${state.runtimePassword}@127.0.0.1:${state.port}/postgres`;
  const directory = path.join(local, 'postgres');
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'enako_dev_admin', password: state.adminPassword, port: state.port, authMethod: 'scram-sha-256', persistent: true, createPostgresUser: false, autoRehydrateSymlinks: true, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  let started = false;
  async function close() {
    if (!started) return;
    started = false;
    if (process.platform === 'win32' && pg.process) {
      const ctl = path.join(root, 'node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe');
      await promisify(execFile)(ctl, ['stop', '-D', directory, '-m', 'fast', '-w', '-t', '15'], { windowsHide: true, timeout: 20000 });
      pg.process = undefined;
    } else await pg.stop();
  }
  try {
    const existing = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 1500 });
    try { await existing.connect(); await existing.query('SELECT 1'); }
    catch {
      if (!fs.existsSync(path.join(directory, 'PG_VERSION'))) await pg.initialise();
      await pg.start(); started = true;
    } finally { await existing.end().catch(() => {}); }
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    try {
      const roles = await admin.query("SELECT rolname FROM pg_roles WHERE rolname IN ('enako_runtime','anon','authenticated')");
      const names = new Set(roles.rows.map(row => row.rolname));
      // Generated hex password is validated above; no user-supplied SQL.
      if (!names.has('enako_runtime')) await admin.query(`CREATE ROLE enako_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${state.runtimePassword}'`);
      for (const name of ['anon', 'authenticated']) if (!names.has(name)) await admin.query(`CREATE ROLE ${name} NOLOGIN`);
      await admin.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
      await admin.query('CREATE SCHEMA IF NOT EXISTS local_setup; REVOKE ALL ON SCHEMA local_setup FROM PUBLIC; CREATE TABLE IF NOT EXISTS local_setup.migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)');
      for (const folder of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
        const file = path.join(root, 'prisma/migrations', folder, 'migration.sql');
        if (!fs.existsSync(file)) continue;
        const sql = fs.readFileSync(file, 'utf8');
        const checksum = createHash('sha256').update(sql).digest('hex');
        const applied = await admin.query('SELECT checksum FROM local_setup.migrations WHERE name = $1', [folder]);
        if (applied.rows.length) {
          if (applied.rows[0].checksum !== checksum) throw new Error('An applied local migration changed: ' + folder);
          continue;
        }
        await admin.query('BEGIN');
        try { await admin.query(sql); await admin.query('INSERT INTO local_setup.migrations (name, checksum) VALUES ($1, $2)', [folder, checksum]); await admin.query('COMMIT'); }
        catch (error) { await admin.query('ROLLBACK'); throw error; }
      }
    } finally { await admin.end(); }
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const db = new PrismaClient({ datasources: { db: { url: adminUrl } } });
    try {
      for (const name of ['CEO', 'CTO', 'MANAGER', 'EMPLOYEE', 'OUTREACH_MANAGER']) await db.role.upsert({ where: { name }, create: { name }, update: {} });
      const role = await db.role.findUniqueOrThrow({ where: { name: 'EMPLOYEE' } });
      const department = await db.department.upsert({ where: { name: 'Engineering' }, create: { name: 'Engineering' }, update: {} });
      await db.user.upsert({ where: { id: 'local-developer' }, update: {}, create: { id: 'local-developer', email: 'developer@enako.local', fullName: 'Local Developer', title: 'Software Developer', roleId: role.id, departmentId: department.id, passwordHash: await bcrypt.hash(state.password, 12) } });
    } finally { await db.$disconnect(); }
    const loginFile = path.join(local, 'login.txt');
    fs.writeFileSync(loginFile, `ENAKOOS LOCAL TEST LOGIN\n\nURL: http://localhost:3000/login?role=EMPLOYEE\nRole: Staff Member\nEmail: developer@enako.local\nPassword: ${state.password}\n\nThis account belongs only to your local development database.\n`, { mode: 0o600 });
    return { close, loginFile, env: { DATABASE_URL: runtimeUrl, DIRECT_URL: runtimeUrl, JWT_ACCESS_SECRET: state.access, JWT_REFRESH_SECRET: state.refresh, CASH_JWT_SECRET: state.cash, JWT_ISSUER: 'http://127.0.0.1:5000', JWT_AUDIENCE: 'enako-local-os', RATE_LIMIT_HASH_SECRET: state.limiter, VAULT_ENCRYPTION_KEY: state.vault, VAULT_OWNER_USER_ID: 'local-developer', OS_PERMISSION_GRANTS: JSON.stringify({ 'local-developer': ['self', 'finance.read', 'finance.write', 'analytics.read', 'digital.manage', 'bd.manage', 'hr.manage', 'outreach.manage', 'audit.read'] }), CASH_ACCESS_GRANTS: '{}', CORS_ORIGIN: 'http://localhost:3000,http://127.0.0.1:3000', SENTRY_ENABLED: 'false' } };
  } catch (error) { await close().catch(() => {}); throw error; }
}
module.exports = { startDevDatabase };
