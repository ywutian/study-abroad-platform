# ADR-0007: API Response Metadata Injection

- Status: accepted
- Date: 2026-02-07
- Decision-makers: Core Team
- Tags: backend, api, observability

## Context

The API response interceptor (`TransformInterceptor`) wrapped all successful responses in `{ success: true, data: T }` but provided no observability metadata. Clients and operators had no way to:

- Correlate a response back to server-side logs
- Measure server-side response time from the client
- Verify which request generated which response in concurrent scenarios

The `x-correlation-id` was set in the response header by middleware, but not exposed in the response body or through CORS `exposedHeaders`.

## Decision

Extend the response wrapper to include a `meta` object:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-02-07T12:00:00.000Z",
    "correlationId": "uuid-here",
    "responseTimeMs": 42
  }
}
```

Additionally:

- Set `X-Response-Time` header on every response
- Add `X-Correlation-Id` to CORS `allowedHeaders` (client can send it)
- Add `X-Correlation-Id`, `X-Response-Time`, `X-RateLimit-*` to CORS `exposedHeaders` (client can read them)
- Error responses from the exception filter also include `correlationId`

## Consequences

### Positive

- Full request traceability from client to server logs
- Client-side performance monitoring without browser dev tools
- Rate limit visibility for frontend retry logic

### Negative

- Response payload slightly larger (~100 bytes per response)
- Frontend code that destructures `{ success, data }` must handle the new `meta` field gracefully

### Neutral

- Error responses from the global exception filter also include `correlationId` for consistency
- The `meta` object is always present on success responses; no feature flag required
