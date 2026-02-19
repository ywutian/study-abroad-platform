import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { registerAndLogin, unwrap } from './helpers/auth.helper';

describe('Vault (e2e)', () => {
  let app: INestApplication<App>;
  let userToken: string;
  let createdItemId: string;

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

  describe('Authentication required', () => {
    it('POST /vaults should require auth', async () => {
      await request(app.getHttpServer())
        .post('/vaults')
        .send({ type: 'CREDENTIAL', title: 'Test', data: 'secret' })
        .expect(401);
    });

    it('GET /vaults should require auth', async () => {
      await request(app.getHttpServer()).get('/vaults').expect(401);
    });
  });

  describe('CRUD operations', () => {
    it('POST /vaults should create a vault item', async () => {
      const res = await request(app.getHttpServer())
        .post('/vaults')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'CREDENTIAL',
          title: 'Test Credential',
          data: 'my-secret-password-123',
          category: 'testing',
          tags: ['test', 'e2e'],
        })
        .expect(201);

      const item = unwrap(res.body);
      expect(item.id).toBeDefined();
      expect(item.title).toBe('Test Credential');
      expect(item.type).toBe('CREDENTIAL');
      createdItemId = item.id;
    });

    it('GET /vaults should list vault items', async () => {
      const res = await request(app.getHttpServer())
        .get('/vaults')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const items = unwrap(res.body);
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /vaults/stats should return vault statistics', async () => {
      const res = await request(app.getHttpServer())
        .get('/vaults/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const stats = unwrap(res.body);
      expect(stats.totalItems).toBeGreaterThanOrEqual(1);
    });

    it('GET /vaults/:id should return vault item detail with decrypted data', async () => {
      if (!createdItemId) return;

      const res = await request(app.getHttpServer())
        .get(`/vaults/${createdItemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const item = unwrap(res.body);
      expect(item.id).toBe(createdItemId);
      expect(item.title).toBe('Test Credential');
      expect(item.data).toBe('my-secret-password-123');
    });

    it('PUT /vaults/:id should update a vault item', async () => {
      if (!createdItemId) return;

      const res = await request(app.getHttpServer())
        .put(`/vaults/${createdItemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Updated Credential', data: 'new-secret-456' })
        .expect(200);

      const item = unwrap(res.body);
      expect(item.title).toBe('Updated Credential');
    });

    it('DELETE /vaults/:id should delete a vault item', async () => {
      if (!createdItemId) return;

      await request(app.getHttpServer())
        .delete(`/vaults/${createdItemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('GET /vaults/:id should return 404 after deletion', async () => {
      if (!createdItemId) return;

      await request(app.getHttpServer())
        .get(`/vaults/${createdItemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('Validation', () => {
    it('POST /vaults should reject missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/vaults')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'No type or data' })
        .expect(400);
    });

    it('POST /vaults should reject invalid type', async () => {
      await request(app.getHttpServer())
        .post('/vaults')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'INVALID_TYPE', title: 'Test', data: 'secret' })
        .expect(400);
    });
  });

  describe('Password generator', () => {
    it('GET /vaults/generate-password should return a password', async () => {
      const res = await request(app.getHttpServer())
        .get('/vaults/generate-password')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const payload = unwrap(res.body);
      expect(payload.password).toBeDefined();
      expect(typeof payload.password).toBe('string');
      expect(payload.password.length).toBeGreaterThanOrEqual(12);
    });
  });
});
