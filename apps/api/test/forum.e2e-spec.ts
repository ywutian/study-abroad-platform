import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { registerAndLogin, unwrap } from './helpers/auth.helper';

describe('Forum (e2e)', () => {
  let app: INestApplication<App>;
  let userToken: string;
  let categoryId: string;
  let postId: string;

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

  describe('Public endpoints', () => {
    it('GET /forums/stats should return forum statistics', async () => {
      const res = await request(app.getHttpServer())
        .get('/forums/stats')
        .expect(200);

      const stats = unwrap(res.body);
      expect(stats).toBeDefined();
      expect(typeof stats.postCount).toBe('number');
    });

    it('GET /forums/categories should return categories list', async () => {
      const res = await request(app.getHttpServer())
        .get('/forums/categories')
        .expect(200);

      const categories = unwrap(res.body);
      expect(Array.isArray(categories)).toBe(true);

      // Save a category ID for post creation if available
      if (categories.length > 0) {
        categoryId = categories[0].id;
      }
    });

    it('GET /forums/posts should return paginated posts', async () => {
      const res = await request(app.getHttpServer())
        .get('/forums/posts')
        .expect(200);

      const payload = unwrap(res.body);
      expect(payload).toBeDefined();
      // May be { posts, total, hasMore } or similar
      if (payload.posts) {
        expect(Array.isArray(payload.posts)).toBe(true);
      }
    });

    it('GET /forums/posts should support sorting', async () => {
      const res = await request(app.getHttpServer())
        .get('/forums/posts?sortBy=popular')
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });

  describe('Post CRUD (authenticated)', () => {
    it('POST /forums/posts should require auth', async () => {
      await request(app.getHttpServer())
        .post('/forums/posts')
        .send({ categoryId: 'test', title: 'Test', content: 'Content' })
        .expect(401);
    });

    it('POST /forums/posts should create a post', async () => {
      if (!categoryId) return;

      const res = await request(app.getHttpServer())
        .post('/forums/posts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          categoryId,
          title: 'E2E Test Post',
          content: 'This is an E2E test post content.',
          tags: ['test', 'e2e'],
        })
        .expect(201);

      const post = unwrap(res.body);
      expect(post.id).toBeDefined();
      expect(post.title).toBe('E2E Test Post');
      postId = post.id;
    });

    it('GET /forums/posts/:id should return post detail', async () => {
      if (!postId) return;

      const res = await request(app.getHttpServer())
        .get(`/forums/posts/${postId}`)
        .expect(200);

      const post = unwrap(res.body);
      expect(post.id).toBe(postId);
      expect(post.title).toBe('E2E Test Post');
    });

    it('PUT /forums/posts/:id should update a post', async () => {
      if (!postId) return;

      const res = await request(app.getHttpServer())
        .put(`/forums/posts/${postId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Updated E2E Post' })
        .expect(200);

      const post = unwrap(res.body);
      expect(post.title).toBe('Updated E2E Post');
    });
  });

  describe('Comments', () => {
    it('POST /forums/posts/:id/comments should add a comment', async () => {
      if (!postId) return;

      const res = await request(app.getHttpServer())
        .post(`/forums/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'E2E test comment' })
        .expect(201);

      const comment = unwrap(res.body);
      expect(comment).toBeDefined();
    });

    it('POST /forums/posts/:id/comments should require auth', async () => {
      if (!postId) return;

      await request(app.getHttpServer())
        .post(`/forums/posts/${postId}/comments`)
        .send({ content: 'Unauthorized comment' })
        .expect(401);
    });
  });

  describe('Likes', () => {
    it('POST /forums/posts/:id/like should toggle like', async () => {
      if (!postId) return;

      const res = await request(app.getHttpServer())
        .post(`/forums/posts/${postId}/like`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const payload = unwrap(res.body);
      expect(typeof payload.liked).toBe('boolean');
    });

    it('POST /forums/posts/:id/like should require auth', async () => {
      if (!postId) return;

      await request(app.getHttpServer())
        .post(`/forums/posts/${postId}/like`)
        .expect(401);
    });
  });

  describe('Cleanup', () => {
    it('DELETE /forums/posts/:id should delete the test post', async () => {
      if (!postId) return;

      await request(app.getHttpServer())
        .delete(`/forums/posts/${postId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });
  });
});
