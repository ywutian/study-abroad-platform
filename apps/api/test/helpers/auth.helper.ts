import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Extract a named cookie value from the Set-Cookie response header.
 */
export function extractCookie(
  res: request.Response,
  cookieName: string,
): string | undefined {
  const rawSetCookie: unknown = res.headers['set-cookie'];
  const setCookie =
    typeof rawSetCookie === 'string' ||
    (Array.isArray(rawSetCookie) &&
      rawSetCookie.every((value) => typeof value === 'string'))
      ? rawSetCookie
      : undefined;
  if (!setCookie) return undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const match = cookies.find((c: string) => c.startsWith(`${cookieName}=`));
  return match?.split(';')[0]?.split('=').slice(1).join('=');
}

/**
 * Unwrap TransformInterceptor response: { success, data, meta } → data
 */
export function unwrap<T = any>(body: unknown): T {
  if (typeof body === 'object' && body !== null && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

interface AuthResult {
  accessToken: string;
  refreshToken: string | undefined;
  email: string;
}

/**
 * Register a new test user and log in, returning tokens.
 */
export async function registerAndLogin(
  app: INestApplication<App>,
  overrides?: { email?: string; password?: string },
): Promise<AuthResult> {
  const email =
    overrides?.email ??
    `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;
  const password = overrides?.password ?? 'TestPassword123!';

  await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password })
    .expect(201);

  // Directly verify email in DB so login succeeds (no SMTP in CI)
  const prisma = app.get(PrismaService);
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  });

  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  const payload = unwrap<{ accessToken: string }>(loginRes.body);

  return {
    accessToken: payload.accessToken,
    refreshToken: extractCookie(loginRes, 'refreshToken'),
    email,
  };
}
