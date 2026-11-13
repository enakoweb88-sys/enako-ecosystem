import * as Sentry from '@sentry/react';
import { privateDataCollection, scrubSentryError, scrubSentrySpan } from './lib/sentry-privacy';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || 'https://abf67a0d28f4a2b6be93a484c35bb18a@o4512388000710656.ingest.de.sentry.io/4512388045733968',
  enabled: import.meta.env.VITE_SENTRY_ENABLED !== 'false',
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || (import.meta.env.PROD ? 'production' : 'development'),
  release: import.meta.env.VITE_SENTRY_RELEASE,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.05,
  tracePropagationTargets: [/^\/api\/v1\//, /^https:\/\/enakoos\.com\/api\/v1\//],
  dataCollection: privateDataCollection,
  beforeSend: event => scrubSentryError(event, 'enako-os'),
  beforeSendSpan: scrubSentrySpan,
  beforeBreadcrumb: () => null,
  beforeSendLog: () => null,
  beforeSendMetric: () => null,
});

// Removed by production builds unless explicitly requested; loopback only.
if (import.meta.env.VITE_SENTRY_VERIFY === '1' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  setTimeout(() => { throw new Error('ENAKO Sentry verification os-' + import.meta.env.VITE_SENTRY_VERIFICATION_ID); }, 1000);
}
