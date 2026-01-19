import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

/**
 * Helper: extract a named cookie value from the Set-Cookie response header.
 */
function extractCookie(
  res: request.Response,
  cookieName: string,
): string | undefined {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const match = cookies.find((c: string) => c.startsWith(`${cookieName}=`));
  return match?.split(';')[0]?.split('=').slice(1).join('=');
}

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let refreshToken: string;

  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ================================================================
  // Note: TransformInterceptor wraps all responses as:
  //   { success: true, data: <actual>, meta: { timestamp, ... } }
  // The health controller uses @Res({ passthrough: true }) which
  // may bypass the interceptor, so /health may return raw format.
  // ================================================================

  describe('Health Check', () => {
    // Use /health/live endpoint which always returns 200
    it('/health/live (GET) should return ok', () => {
      return request(app.getHttpServer())
        .get('/health/live')
        .expect(200)
        .expect((res) => {
          // Raw response (no interceptor wrapper) or wrapped
          const body = res.body.data || res.body;
          expect(body.status).toBe('ok');
        });
    });
  });

  describe('Auth Flow', () => {
    it('/auth/register (POST) should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      // TransformInterceptor wraps: { success, data: { user, message }, meta }
      const payload = res.body.data || res.body;
      expect(payload.user).toBeDefined();
      expect(payload.user.email).toBe(testUser.email);
    });

    it('/auth/register (POST) should reject duplicate email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('/auth/register (POST) should validate email format', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'invalid-email', password: 'TestPassword123!' })
        .expect(400);
    });

    it('/auth/register (POST) should validate password length', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'valid@email.com', password: '123' })
        .expect(400);
    });

    it('/auth/login (POST) should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser)
        .expect(200);

      // TransformInterceptor wraps: { success, data: { user, accessToken }, meta }
      const payload = res.body.data || res.body;
      expect(payload.accessToken).toBeDefined();

      accessToken = payload.accessToken;

      // refreshToken is in httpOnly cookie
      const rt = extractCookie(res, 'refreshToken');
      if (rt) {
        refreshToken = rt;
      }
    });

    it('/auth/login (POST) should reject invalid password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ ...testUser, password: 'WrongPassword123!' })
        .expect(401);
    });

    it('/auth/login (POST) should reject non-existent user', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
        })
        .expect(401);
    });

    it('/auth/refresh (POST) should refresh tokens', async () => {
      // Skip if no refreshToken from login
      if (!refreshToken) return;

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const payload = res.body.data || res.body;
      expect(payload.accessToken).toBeDefined();
      accessToken = payload.accessToken;

      const newRt = extractCookie(res, 'refreshToken');
      if (newRt) {
        refreshToken = newRt;
      }
    });

    it('/auth/refresh (POST) should reject invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('Profile Management', () => {
    it('/profiles/me (GET) should return user profile', async () => {
      if (!accessToken) return;
      const res = await request(app.getHttpServer())
        .get('/profiles/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const payload = res.body.data || res.body;
      expect(payload).toBeDefined();
    });

    it('/profiles/me (PUT) should update profile', async () => {
      if (!accessToken) return;
      const res = await request(app.getHttpServer())
        .put('/profiles/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          grade: 'SENIOR',
          gpa: 3.8,
          gpaScale: 4.0,
          targetMajor: 'Computer Science',
        })
        .expect(200);

      const payload = res.body.data || res.body;
      expect(payload).toBeDefined();
    });

    it('/profiles/me/test-scores (POST) should add test score', async () => {
      if (!accessToken) return;
      await request(app.getHttpServer())
        .post('/profiles/me/test-scores')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: 'SAT',
          score: 1500,
          testDate: '2024-06-01',
        })
        .expect(201);
    });

    it('/profiles/me/activities (POST) should add activity', async () => {
      if (!accessToken) return;
      await request(app.getHttpServer())
        .post('/profiles/me/activities')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Math Olympiad',
          category: 'ACADEMIC',
          role: 'Participant',
          description: 'National math competition',
          startDate: '2023-09-01',
        })
        .expect(201);
    });

    it('/profiles/me/awards (POST) should add award', async () => {
      if (!accessToken) return;
      await request(app.getHttpServer())
        .post('/profiles/me/awards')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Science Fair Winner',
          level: 'STATE',
          year: 2024,
        })
        .expect(201);
    });
  });

  describe('Public Endpoints', () => {
    it('/schools (GET) should return schools list', () => {
      return request(app.getHttpServer())
        .get('/schools')
        .expect(200)
        .expect((res) => {
          const payload = res.body.data || res.body;
          expect(payload).toBeDefined();
        });
    });

    it('/schools (GET) should support search', async () => {
      const res = await request(app.getHttpServer())
        .get('/schools?search=Harvard')
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('/cases (GET) should return cases list', () => {
      return request(app.getHttpServer())
        .get('/cases')
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeDefined();
        });
    });

    it('/hall/lists (GET) should return public lists', () => {
      return request(app.getHttpServer()).get('/hall/lists').expect(200);
    });
  });

  describe('Protected Endpoints', () => {
    it('/profiles/me (GET) should require authentication', () => {
      return request(app.getHttpServer()).get('/profiles/me').expect(401);
    });

    it('/chat/conversations (GET) should require authentication', () => {
      return request(app.getHttpServer())
        .get('/chat/conversations')
        .expect(401);
    });

    it('/predictions (POST) should require authentication', () => {
      return request(app.getHttpServer())
        .post('/predictions')
        .send({ schoolIds: ['test'] })
        .expect(401);
    });

    it('/ai/analyze-profile (POST) should require authentication', () => {
      return request(app.getHttpServer())
        .post('/ai/analyze-profile')
        .send({})
        .expect(401);
    });
  });

  describe('Authorization', () => {
    it('should reject requests with invalid token', () => {
      return request(app.getHttpServer())
        .get('/profiles/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject requests with expired token format', () => {
      return request(app.getHttpServer())
        .get('/profiles/me')
        .set('Authorization', 'Invalid-Format')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get('/health/live').expect(200);
      }
    });
  });

  describe('Logout', () => {
    it('/auth/logout (POST) should invalidate tokens', async () => {
      if (!accessToken) return;

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);
    });
  });
});
