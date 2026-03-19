import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { registerAndLogin } from './helpers/auth.helper';

describe('Admin (e2e)', () => {
  let app: INestApplication<App>;
  let userToken: string;
  let _userEmail: string;

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
    _userEmail = auth.email;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Authorization - regular user denied', () => {
    it('GET /admin/stats should reject non-admin user', async () => {
      await request(app.getHttpServer())
        .get('/admin/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('GET /admin/users should reject non-admin user', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('GET /admin/reports should reject non-admin user', async () => {
      await request(app.getHttpServer())
        .get('/admin/reports')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('GET /admin/audit-logs should reject non-admin user', async () => {
      await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('PUT /admin/users/:id/role should reject non-admin user', async () => {
      await request(app.getHttpServer())
        .put('/admin/users/some-user-id/role')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'ADMIN' })
        .expect(403);
    });

    it('POST /admin/users/:id/ban should reject non-admin user', async () => {
      await request(app.getHttpServer())
        .post('/admin/users/some-user-id/ban')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'test', permanent: false })
        .expect(403);
    });
  });

  describe('Authentication required', () => {
    it('GET /admin/stats should require auth', async () => {
      await request(app.getHttpServer()).get('/admin/stats').expect(401);
    });

    it('GET /admin/users should require auth', async () => {
      await request(app.getHttpServer()).get('/admin/users').expect(401);
    });

    it('GET /admin/stats/trends should require auth', async () => {
      await request(app.getHttpServer()).get('/admin/stats/trends').expect(401);
    });
  });
});
