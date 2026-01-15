import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let refreshToken: string;
  let userId: string;

  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/health (GET) should return ok', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.timestamp).toBeDefined();
        });
    });
  });

  describe('Auth Flow', () => {
    it('/auth/register (POST) should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.message).toBeDefined();
      userId = res.body.user.id;
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
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.tokens).toBeDefined();
      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.tokens.refreshToken).toBeDefined();

      accessToken = res.body.tokens.accessToken;
      refreshToken = res.body.tokens.refreshToken;
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
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('/auth/refresh (POST) should reject invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('/auth/me (GET) should return current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
    });
  });

  describe('Profile Management', () => {
    it('/profile (GET) should return user profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('/profile (PUT) should update profile', async () => {
      const res = await request(app.getHttpServer())
        .put('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          grade: '12',
          gpa: 3.8,
          gpaScale: 4.0,
          targetMajor: 'Computer Science',
        })
        .expect(200);

      expect(res.body.grade).toBe('12');
      expect(res.body.targetMajor).toBe('Computer Science');
    });

    it('/profile/test-scores (POST) should add test score', async () => {
      const res = await request(app.getHttpServer())
        .post('/profile/test-scores')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          testType: 'SAT',
          score: 1500,
          testDate: '2024-06-01',
        })
        .expect(201);

      expect(res.body.testType).toBe('SAT');
      expect(res.body.score).toBe(1500);
    });

    it('/profile/activities (POST) should add activity', async () => {
      const res = await request(app.getHttpServer())
        .post('/profile/activities')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Math Olympiad',
          category: 'ACADEMIC',
          role: 'Participant',
          description: 'National math competition',
          startDate: '2023-09-01',
        })
        .expect(201);

      expect(res.body.title).toBe('Math Olympiad');
    });

    it('/profile/awards (POST) should add award', async () => {
      const res = await request(app.getHttpServer())
        .post('/profile/awards')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Science Fair Winner',
          level: 'STATE',
          year: 2024,
        })
        .expect(201);

      expect(res.body.title).toBe('Science Fair Winner');
      expect(res.body.level).toBe('STATE');
    });
  });

  describe('Public Endpoints', () => {
    it('/schools (GET) should return schools list', () => {
      return request(app.getHttpServer())
        .get('/schools')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.total).toBeDefined();
          expect(res.body.page).toBeDefined();
        });
    });

    it('/schools (GET) should support pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/schools?page=1&pageSize=5')
        .expect(200);

      expect(res.body.pageSize).toBe(5);
    });

    it('/schools (GET) should support search', async () => {
      const res = await request(app.getHttpServer())
        .get('/schools?search=Harvard')
        .expect(200);

      expect(res.body.data).toBeDefined();
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
    it('/profile (GET) should require authentication', () => {
      return request(app.getHttpServer()).get('/profile').expect(401);
    });

    it('/chat/conversations (GET) should require authentication', () => {
      return request(app.getHttpServer())
        .get('/chat/conversations')
        .expect(401);
    });

    it('/prediction (POST) should require authentication', () => {
      return request(app.getHttpServer())
        .post('/prediction')
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
        .get('/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject requests with expired token format', () => {
      return request(app.getHttpServer())
        .get('/profile')
        .set('Authorization', 'Invalid-Format')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get('/health').expect(200);
      }
    });
  });

  describe('Logout', () => {
    it('/auth/logout (POST) should invalidate tokens', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(201);

      // Old refresh token should no longer work
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
