# ADR-0005: Production Security Headers (Helmet CSP + HSTS)

- Status: accepted
- Date: 2026-02-07
- Decision-makers: Core Team
- Tags: backend, security, helmet

## Context

The application used Helmet with minimal configuration — CSP was explicitly disabled in development (`false`) and set to `undefined` (Helmet default) in production. No HSTS, no explicit frame options, and no referrer policy were configured.

This left the API exposed to:

- Clickjacking attacks (no `X-Frame-Options`)
- MIME-type sniffing attacks
- Mixed content issues (no `upgrade-insecure-requests`)
- Missing transport layer security enforcement (no HSTS)

## Decision

Configure Helmet with environment-aware security headers:

**Production only:**

- **CSP**: `default-src 'self'`, strict script/style/img/connect/font/object/frame directives
- **HSTS**: `max-age=31536000` (1 year), `includeSubDomains`, `preload`
- **Frame options**: `DENY`

**All environments:**

- **X-Content-Type-Options**: `nosniff`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **X-Powered-By**: hidden

**Development:**

- CSP disabled (allows dev tools, hot reload, etc.)
- HSTS disabled (localhost doesn't use HTTPS)

## Consequences

### Positive

- OWASP-compliant security headers in production
- Protection against common web attack vectors
- Development experience preserved (no restrictive headers in dev)

### Negative

- CSP may block legitimate external resources if not configured correctly
- HSTS preload is permanent — requires commitment to HTTPS

### Neutral

- Helmet is already a dependency; no new packages required
- CSP directives will need updating when integrating new third-party services
