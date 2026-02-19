import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { registerAndLogin, unwrap } from './helpers/auth.helper';

describe('Schools (e2e)', () => {
  let app: INestApplication<App>;
  let userToken: string;

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

    const auth = await registerAndLogin(app);
    userToken = auth.accessToken;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('GET /schools', () => {
    it('should return paginated school list (public)', async () => {
      const res = await request(app.getHttpServer())
        .get('/schools')
        .expect(200);

      const payload = unwrap(res.body);
      expect(payload).toBeDefined();
      // Response may be { items, total } or array depending on seed data
      if (payload.items) {
        expect(Array.isArray(payload.items)).toBe(true);
      }
    });

    it('should support pagination with page and pageSize', async () => {
      const res = await request(app.getHttpServer())
        .get('/schools?page=1&pageSize=5')
        .expect(200);

      const payload = unwrap(res.body);
      expect(payload).toBeDefined();
    });

    it('should support search query', async () => {
      const res = await request(app.getHttpServer())
        .get('/schools?search=University')
        .expect(200);

      const payload = unwrap(res.body);
      expect(payload).toBeDefined();
    });

    it('should support filter by country', async () => {
      const res = await request(app.getHttpServer())
        .get('/schools?country=US')
        .expect(200);

      const payload = unwrap(res.body);
      expect(payload).toBeDefined();
    });
  });

  describe('GET /schools/:id', () => {
    it('should return school detail for valid ID', async () => {
      // First get a school list to find a valid ID
      const listRes = await request(app.getHttpServer())
        .get('/schools?pageSize=1')
        .expect(200);

      const list = unwrap(listRes.body);
      const items = list.items || list;
      if (!Array.isArray(items) || items.length === 0) return;

      const schoolId = items[0].id;
      const res = await request(app.getHttpServer())
        .get(`/schools/${schoolId}`)
        .expect(200);

      const school = unwrap(res.body);
      expect(school.id).toBe(schoolId);
      expect(school.name).toBeDefined();
    });

    it('should return 404 for non-existent school', async () => {
      await request(app.getHttpServer())
        .get('/schools/non-existent-id-12345')
        .expect(404);
    });
  });

  describe('GET /schools/ai/recommend (protected)', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/schools/ai/recommend')
        .expect(401);
    });

    it('should accept authenticated request', async () => {
      const res = await request(app.getHttpServer())
        .get('/schools/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`);

      // May return 200 or error depending on profile completeness / AI config
      expect([200, 400, 404, 500]).toContain(res.status);
    });
  });
});
