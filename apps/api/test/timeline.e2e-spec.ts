import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerAndLogin, unwrap } from './helpers/auth.helper';

describe('Timeline closure (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let otherToken: string;
  let timelineId: string;
  let schoolId: string;

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

    ownerToken = (await registerAndLogin(app)).accessToken;
    otherToken = (await registerAndLogin(app)).accessToken;

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const school = await app.get(PrismaService).school.create({
      data: {
        name: `Closure School ${suffix}`,
        nameNorm: `closure school ${suffix}`,
        acceptanceRate: 25,
      },
    });
    schoolId = school.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('creates a timeline with its default tasks', async () => {
    const response = await request(app.getHttpServer())
      .post('/timelines')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        schoolId,
        round: 'RD',
        deadline: '2027-01-15T23:59:59.000Z',
        notes: 'Closure timeline',
      })
      .expect(201);

    const timeline = unwrap(response.body);
    timelineId = timeline.id;
    expect(timeline.schoolId).toBe(schoolId);
    expect(timeline.tasksTotal).toBeGreaterThan(0);
  });

  it('reads embedded tasks from GET /timelines/:id', async () => {
    const response = await request(app.getHttpServer())
      .get(`/timelines/${timelineId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const timeline = unwrap(response.body);
    expect(Array.isArray(timeline.tasks)).toBe(true);
    expect(timeline.tasks).toHaveLength(timeline.tasksTotal);
    expect(timeline.tasks[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
      }),
    );
  });

  it('adds a task and reads it back through the timeline detail contract', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/timelines/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        timelineId,
        title: 'Closure custom task',
        type: 'DOCUMENT',
      })
      .expect(201);
    const createdTask = unwrap(createResponse.body);

    const detailResponse = await request(app.getHttpServer())
      .get(`/timelines/${timelineId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(unwrap(detailResponse.body).tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdTask.id,
          title: 'Closure custom task',
        }),
      ]),
    );
  });

  it('does not expose a timeline to another user', async () => {
    await request(app.getHttpServer())
      .get(`/timelines/${timelineId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('deletes the timeline and its task detail surface', async () => {
    await request(app.getHttpServer())
      .delete(`/timelines/${timelineId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/timelines/${timelineId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });
});
