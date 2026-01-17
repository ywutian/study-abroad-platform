import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Environment
  environment: process.env.NODE_ENV,

  // Filter out noisy errors
  ignoreErrors: [
    // Random plugins/extensions
    'top.GLOBALS',
    // Chrome extensions
    /^chrome-extension:\/\//,
    // Network errors
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // User aborted
    'AbortError',
    // Third party scripts
    /^Script error\.$/,
  ],

  // Before sending events
  beforeSend(event, _hint) {
    // Filter out events in development
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }

    // Don't send events for 404 errors
    if (event.exception?.values?.[0]?.type === 'NotFoundError') {
      return null;
    }

    return event;
  },

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
