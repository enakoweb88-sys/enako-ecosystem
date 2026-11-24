// Local development uses a persistent loopback database and test login.
const { spawn } = require('node:child_process');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { startDevDatabase } = require('./dev-database.cjs');

async function main() {
  const database = await startDevDatabase();
  console.log('Persistent local database ready. Test login details: ' + database.loginFile);
  const child = spawn(process.execPath, [require.resolve('@nestjs/cli/bin/nest.js'), 'start', '--watch'], {
    cwd: require('node:path').resolve(__dirname, '..'),
    env: { ...process.env, ...database.env, PORT: '5000', NODE_ENV: 'development', GATEWAY_ACCESS_MODE: 'local-only' },
    stdio: 'inherit', windowsHide: true,
  });
  let closing = false;
  async function finish(code) {
    if (closing) return;
    closing = true;
    try {
      if (child.exitCode === null && child.signalCode === null) {
        if (process.platform === 'win32') await promisify(execFile)('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }).catch(() => {});
        else child.kill('SIGTERM');
      }
      await database.close();
    } finally { process.exit(code); }
  }
  child.on('error', () => { console.error('Local backend could not start.'); void finish(1); });
  child.on('exit', code => { void finish(code ?? 1); });
  process.on('SIGINT', () => { void finish(0); });
  process.on('SIGTERM', () => { void finish(0); });
}
main().catch(error => { console.error('Local development setup failed: ' + String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED_URL]')); process.exitCode = 1; });
