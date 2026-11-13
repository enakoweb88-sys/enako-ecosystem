import type { ErrorEvent, init } from '@sentry/nestjs';
type SentryOptions = NonNullable<Parameters<typeof init>[0]>;
type StreamedSpanJSON = Parameters<NonNullable<SentryOptions['beforeSendSpan']>>[0];

// No request/customer data, document contents, tokens or free-text logs leave the app.
export const privateDataCollection: NonNullable<SentryOptions['dataCollection']> = {
  userInfo: false, cookies: false, httpHeaders: false, httpBodies: [],
  urlQueryParams: false, databaseQueryData: false, queues: false,
  stackFrameVariables: false, frameContextLines: 0,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false }, mcp: { inputs: false, outputs: false },
};

function sourceFile(value: string | undefined) {
  if (!value) return undefined;
  if (/^https?:/.test(value)) {
    try { const url = new URL(value); return url.origin + url.pathname; } catch { return undefined; }
  }
  const normalized = value.replace(/\\/g, '/').split(/[?#]/)[0];
  const index = Math.max(normalized.lastIndexOf('/dist/'), normalized.lastIndexOf('/src/'));
  return index >= 0 ? 'app:///' + normalized.slice(index + 1) : normalized.split('/').pop();
}

export function scrubSentryError(event: ErrorEvent, application: string): ErrorEvent {
  const trace = event.contexts?.trace;
  return {
    type: undefined, event_id: event.event_id, timestamp: event.timestamp,
    platform: event.platform, level: event.level, environment: event.environment,
    release: event.release, dist: event.dist,
    tags: { application },
    contexts: trace ? { trace: {
      trace_id: trace.trace_id, span_id: trace.span_id,
      parent_span_id: trace.parent_span_id,
    } } : undefined,
    exception: event.exception ? { values: event.exception.values?.map(value => ({
      type: value.type && /^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(value.type) ? value.type : 'Error',
      value: value.value && /^ENAKO Sentry verification [a-z0-9-]+$/.test(value.value)
        ? value.value : 'Application error; sensitive details omitted',
      mechanism: value.mechanism ? { type: 'generic', handled: value.mechanism.handled } : undefined,
      stacktrace: value.stacktrace ? { frames: value.stacktrace.frames?.map(frame => ({
        filename: sourceFile(frame.filename), function: frame.function && /^[\w.$<> [\]-]{1,200}$/.test(frame.function) ? frame.function : undefined,
        lineno: frame.lineno, colno: frame.colno, in_app: frame.in_app,
      })) } : undefined,
    })) } : undefined,
    debug_meta: event.debug_meta ? { images: event.debug_meta.images?.filter(image => image.type === 'sourcemap').map(image => ({
      type: image.type, debug_id: image.debug_id, code_file: sourceFile(image.code_file) || 'app:///unknown',
    })) } : undefined,
  };
}

export function scrubSentrySpan(span: StreamedSpanJSON): StreamedSpanJSON {
  const attributes: StreamedSpanJSON['attributes'] = {};
  for (const key of ['sentry.op', 'sentry.origin', 'sentry.sample_rate', 'http.request.method', 'http.response.status_code', 'db.system']) {
    const value = span.attributes[key];
    if (typeof value === 'number' || typeof value === 'boolean' ||
        (typeof value === 'string' && /^[A-Za-z_.-]{1,80}$/.test(value))) attributes[key] = value;
  }
  return { trace_id: span.trace_id, parent_span_id: span.parent_span_id,
    span_id: span.span_id, name: typeof attributes['sentry.op'] === 'string' ? attributes['sentry.op'] : 'application.operation',
    start_timestamp: span.start_timestamp, end_timestamp: span.end_timestamp,
    status: span.status, is_segment: span.is_segment, attributes };
}
