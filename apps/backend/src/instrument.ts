// Must load before NestJS, Express, Prisma or other application modules.
import * as Sentry from '@sentry/nestjs';
import { privateDataCollection, scrubSentryError, scrubSentrySpan } from './common/sentry-privacy';

const dsn = process.env.SENTRY_DSN || 'https://a9e32324d5e6def328f6b60629f61236@o4512388000710656.ingest.de.sentry.io/4512388045602896';
const verification = process.env.ENAKO_SENTRY_VERIFY === '1';
const environment = verification ? 'verification' : process.env.NODE_ENV === 'production' ? 'production' : 'development';
Sentry.init({
  dsn,
  enabled: process.env.SENTRY_ENABLED !== 'false' && (verification || process.env.NODE_ENV !== 'test'),
  environment,
  release: process.env.SENTRY_RELEASE || 'enako-backend@' + (process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || 'development'),
  dataCollection: privateDataCollection,
  tracesSampler: context => /\/health\b/.test(context.name + ' ' + (context.normalizedRequest?.url || '')) ? 0 : 0.05,
  beforeSend: event => scrubSentryError(event, 'enako-backend'),
  beforeSendSpan: scrubSentrySpan,
  beforeBreadcrumb: () => null,
  beforeSendLog: () => null,
  beforeSendMetric: () => null,
});
