import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { extractCookie, registerAndLogin, unwrap } from './helpers/auth.helper';

describe('Auth session closure (e2e)', () => {
  let app: INestApplication<App>;

  async function loginAgain(credentials: { email: string; password: string }) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);
    return {
      accessToken: unwrap(response.body).accessToken as string,
      refreshToken: extractCookie(response, 'refreshToken'),
    };
  }

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

  it('revokes only the supplied session during ordinary logout', async () => {
    const credentials = {
      email: `logout-one-${Date.now()}@test.com`,
      password: 'TestPassword123!',
    };
    const first = await registerAndLogin(app, credentials);
    const second = await loginAgain(credentials);

    expect(first.refreshToken).toBeDefined();
    expect(second.refreshToken).toBeDefined();

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ refreshToken: first.refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: second.refreshToken })
      .expect(200);
  });

  it('revokes every session when logout is called without a refresh token', async () => {
    const credentials = {
      email: `logout-all-${Date.now()}@test.com`,
      password: 'TestPassword123!',
    };
    const first = await registerAndLogin(app, credentials);
    const second = await loginAgain(credentials);

    expect(first.refreshToken).toBeDefined();
    expect(second.refreshToken).toBeDefined();

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: second.refreshToken })
      .expect(401);
  });
});
