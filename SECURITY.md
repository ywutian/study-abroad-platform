# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, report it through internal channels.

### Reporting Process

1. **Email**: security@study-abroad-platform.com
2. **Include**: description, reproduction steps, impact assessment, and suggested fix if available
3. **DO NOT** discuss vulnerabilities in public channels (Slack, issue tracker, etc.)

### Response Timeline

| Timeline | Action                                         |
| -------- | ---------------------------------------------- |
| 24 hours | Acknowledgment of report                       |
| 72 hours | Initial assessment and severity classification |
| 7 days   | Remediation plan                               |
| 30 days  | Fix deployed (Critical/High)                   |

### Severity Classification (CVSS v3.1)

| Severity | Score    | Response           |
| -------- | -------- | ------------------ |
| Critical | 9.0-10.0 | Immediate hotfix   |
| High     | 7.0-8.9  | Within 7 days      |
| Medium   | 4.0-6.9  | Within 30 days     |
| Low      | 0.1-3.9  | Next release cycle |

## Security Architecture

This project implements the following security measures:

- **Authentication**: JWT with refresh token rotation
- **Authorization**: RBAC (ADMIN, VERIFIED, USER roles)
- **Rate Limiting**: Per-endpoint throttling (login: 3/min, register: 5/min)
- **Input Validation**: NestJS ValidationPipe + class-validator DTOs
- **XSS Prevention**: Content sanitization on user-generated content
- **CORS**: Configurable origin whitelist (CORS_ORIGINS env var)
- **Docker**: Non-root container user in production
- **Security Headers**: Helmet CSP + HSTS + frameguard (production)
- **Environment Validation**: Zod schema validation at startup
- **Data Encryption**: Vault module for sensitive credential storage
- **PII Protection**: Log sanitization for 15+ sensitive fields

## Scope

In scope:

- Authentication/authorization bypasses
- Injection vulnerabilities (SQL, XSS, CSRF)
- Sensitive data exposure (PII, tokens, credentials)
- SSRF, RCE, privilege escalation

Out of scope:

- DoS/DDoS attacks
- Social engineering
- Third-party dependency issues (report upstream)
