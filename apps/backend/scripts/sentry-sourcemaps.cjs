const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { execFileSync } = require('node:child_process');
const SentryCli = require('@sentry/cli');

(async () => {
  const root = path.resolve(__dirname, '..');
  process.chdir(root);
  const artifacts = fs.realpathSync(path.join(root, 'dist'));
  if (artifacts !== path.join(root, 'dist')) throw new Error('Unexpected source-map artifact directory');
  const localFile = path.join(root, '.env.sentry-build-plugin');
  const authToken = process.env.SENTRY_AUTH_TOKEN || (fs.existsSync(localFile) ? parseEnv(fs.readFileSync(localFile, 'utf8')).SENTRY_AUTH_TOKEN : undefined);
  let revision = process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA;
  if (!revision) {
    try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { revision = 'development'; }
  }
  const release = process.env.SENTRY_RELEASE || 'enako-backend@' + revision;
  const cli = new SentryCli(null, { org: 'enako-vh', project: 'enako-backend' });
  // Debug IDs are injected even without a token, so CI-uploaded artifacts can be matched.
  await cli.execute(['sourcemaps', 'inject', artifacts], false);
  if (!authToken || process.env.SENTRY_UPLOAD_SOURCE_MAPS !== 'true') { console.log('[Sentry] Debug IDs injected. Source-map upload disabled without explicit opt-in and a build token.'); return; }
  process.env.SENTRY_AUTH_TOKEN = authToken;
  await cli.execute(['sourcemaps', 'upload', '--org', 'enako-vh', '--project', 'enako-backend', '--release', release, artifacts], false);
  console.log('[Sentry] Backend source maps uploaded to enako-vh/enako-backend.');
})().catch(() => { console.error('[Sentry] Source-map preparation failed; no credentials were displayed.'); process.exitCode = 1; });
