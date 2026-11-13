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
  const release = process.env.SENTRY_RELEASE || 'enako-os@' + revision;
  return {
    define: {'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(release)},
    build: {sourcemap: uploadApproved && authToken ? 'hidden' as const : false},
    plugins: [react(), tailwindcss(), ...(uploadApproved && authToken ? [sentryVitePlugin({
      org: 'enako-vh', project: 'enako-os', authToken, telemetry: false,
      release: {name: release},
      sourcemaps: {assets: './dist/**', filesToDeleteAfterUpload: ['./dist/**/*.map']},
    })] : [])],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
  
