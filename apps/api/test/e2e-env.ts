/**
 * E2E tests must be deterministic and side-effect free even when the developer
 * shell has production-like credentials loaded. Individual provider contract
 * tests can opt into external I/O in a separate, explicit test job.
 */
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';
process.env.OPENAI_API_KEY = '';
process.env.TAVILY_API_KEY = '';
process.env.BRAVE_SEARCH_API_KEY = '';
process.env.GOOGLE_SEARCH_API_KEY = '';
process.env.GOOGLE_SEARCH_ENGINE_ID = '';
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
