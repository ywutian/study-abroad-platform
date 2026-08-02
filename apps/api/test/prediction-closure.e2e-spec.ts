import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerAndLogin, unwrap } from './helpers/auth.helper';

describe('Free prediction closure (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
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
    prisma = app.get(PrismaService);

    const auth = await registerAndLogin(app);
    token = auth.accessToken;
    userId = (
      await prisma.user.findUniqueOrThrow({ where: { email: auth.email } })
    ).id;

    await request(app.getHttpServer())
      .put('/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        grade: 'SENIOR',
        gpa: 3.9,
        gpaScale: 4,
        targetMajor: 'Computer Science',
        nationality: 'US',
      })
      .expect(200);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const school = await prisma.school.create({
      data: {
        name: `Prediction Closure School ${suffix}`,
        nameNorm: `prediction closure school ${suffix}`,
        acceptanceRate: 25,
        satAvg: 1400,
        sat25: 1320,
        sat75: 1480,
        act25: 29,
        act75: 34,
      },
    });
    schoolId = school.id;

    await request(app.getHttpServer())
      .post('/school-lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ schoolId, tier: 'TARGET', round: 'RD' })
      .expect(201);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('starts at zero points and still generates a persisted prediction', async () => {
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).points,
    ).toBe(0);

    const response = await request(app.getHttpServer())
      .post('/predictions')
      .set('Authorization', `Bearer ${token}`)
      .send({ schoolIds: [schoolId], forceRefresh: true })
      .expect(201);

    const payload = unwrap(response.body);
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]).toMatchObject({
      schoolId,
      predictionMethod: 'counselor',
    });
    expect(payload.results[0].probability).toEqual(expect.any(Number));
    expect(payload.results[0].factors.length).toBeGreaterThan(0);

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(storedUser.points).toBe(0);
    expect(await prisma.pointHistory.count({ where: { userId } })).toBe(0);
  });

  it('reads the generated result through dashboard and history contracts', async () => {
    const dashboardResponse = await request(app.getHttpServer())
      .get('/predictions/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const dashboard = unwrap(dashboardResponse.body);
    expect(dashboard.predictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schoolId,
          factors: expect.any(Array),
          suggestions: expect.any(Array),
          publicExplanation: expect.objectContaining({
            headline: expect.any(String),
            dataSupportLabel: expect.any(String),
          }),
        }),
      ]),
    );

    const historyResponse = await request(app.getHttpServer())
      .get('/predictions/history?page=1&pageSize=20')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const history = unwrap(historyResponse.body);
    expect(history.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ schoolId })]),
    );
  });

  it('reports an actual result and returns it on the prediction dashboard', async () => {
    await request(app.getHttpServer())
      .patch(`/predictions/${schoolId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ result: 'ADMITTED', round: 'RD', isFinal: true })
      .expect(200);

    const dashboardResponse = await request(app.getHttpServer())
      .get('/predictions/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const prediction = unwrap(dashboardResponse.body).predictions.find(
      (item: { schoolId: string }) => item.schoolId === schoolId,
    );
    expect(prediction.latestOutcomeLabel).toMatchObject({
      result: 'ADMITTED',
      round: 'RD',
      status: 'SELF_REPORTED',
    });
    const storedOutcome = await prisma.predictionOutcomeLabelRecord.findFirst({
      where: { predictionResult: { profile: { userId }, schoolId } },
      orderBy: { createdAt: 'desc' },
    });
    expect(storedOutcome?.isFinal).toBe(true);
    expect(storedOutcome?.reportedBy).toBe(userId);

    const outcomesResponse = await request(app.getHttpServer())
      .get('/predictions/outcomes/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unwrap(outcomesResponse.body)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: storedOutcome?.id,
          result: 'ADMITTED',
          schoolName: expect.any(String),
        }),
      ]),
    );
  });
});
