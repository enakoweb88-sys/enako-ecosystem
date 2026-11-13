import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {sentryVitePlugin} from '@sentry/bundler-plugins/vite';
import {execFileSync} from 'node:child_process';

export default defineConfig(() => {
  const uploadApproved = process.env.SENTRY_UPLOAD_SOURCE_MAPS === 'true';
  const authToken = process.env.SENTRY_AUTH_TOKEN || loadEnv('sentry-build-plugin', process.cwd(), 'SENTRY_').SENTRY_AUTH_TOKEN;
  const revision = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  const release = process.env.SENTRY_RELEASE || 'enako-cash@' + revision;
  return {
    define: {'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(release)},
    build: {sourcemap: uploadApproved && authToken ? 'hidden' : false},
    plugins: [react(), tailwindcss(), ...(uploadApproved && authToken ? [sentryVitePlugin({
      org: 'enako-vh', project: 'enako-cash', authToken, telemetry: false,
      release: {name: release},
      sourcemaps: {assets: './dist/**', filesToDeleteAfterUpload: ['./dist/**/*.map']},
    })] : [])],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
