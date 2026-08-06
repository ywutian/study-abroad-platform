import { resolveApplicationYear } from '@study-abroad/shared';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerAndLogin, unwrap } from './helpers/auth.helper';

describe('Outcome reporting closure (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;
  let userId: string;
  let predictionResultId: string;
  let outcomeId: string;

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
    otherToken = (await registerAndLogin(app)).accessToken;

    await request(app.getHttpServer())
      .put('/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        grade: 'SENIOR',
        gpa: 3.8,
        gpaScale: 4,
        targetMajor: 'Economics',
      })
      .expect(200);
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { userId },
    });
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const school = await prisma.school.create({
      data: {
        name: `Outcome Closure School ${suffix}`,
        nameNorm: `outcome closure school ${suffix}`,
      },
    });
    await prisma.schoolListItem.create({
      data: { userId, schoolId: school.id, round: 'RD' },
    });
    // Deadline and prediction must name the SAME season. This line used to
    // read `new Date().getFullYear()` — the calendar year, not the
    // application season — and passed only because neither side carried a
    // season at all.
    const season = resolveApplicationYear();
    await prisma.schoolDeadline.create({
      data: {
        schoolId: school.id,
        year: season,
        round: 'RD',
        applicationDeadline: new Date(Date.now() - 60 * 86400000),
        decisionDate: new Date(Date.now() - 86400000),
      },
    });
    const prediction = await prisma.predictionResult.create({
      data: {
        profileId: profile.id,
        schoolId: school.id,
        probability: 0.42,
        factors: [{ name: 'GPA', impact: 'positive', detail: 'Competitive' }],
        suggestions: ['Keep grades strong'],
        tier: 'match',
        confidence: 'medium',
        source: 'prediction',
        authority: 'AUTHORITATIVE',
        applicationRound: 'RD',
        applicationYear: season,
      },
    });
    predictionResultId = prediction.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('shows a released saved-school prediction as pending', async () => {
    const response = await request(app.getHttpServer())
      .get('/predictions/outcomes/pending-decisions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unwrap(response.body)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predictionResultId,
          probability: 0.42,
          applicationRound: 'RD',
        }),
      ]),
    );
  });

  it('rejects a different user and accepts the owner without awarding points', async () => {
    await request(app.getHttpServer())
      .post('/predictions/outcomes')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ predictionResultId, result: 'ADMITTED' })
      .expect(403);

    const response = await request(app.getHttpServer())
      .post('/predictions/outcomes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        predictionResultId,
        result: 'ADMITTED',
        round: 'RD',
        notes: 'Accepted through regular decision',
        evidenceUrl: 'https://example.test/acceptance.pdf',
        shareWithFutureApplicants: true,
      })
      .expect(201);
    const payload = unwrap(response.body);
    outcomeId = payload.id;
    expect(payload).toMatchObject({
      predictionResultId,
      result: 'ADMITTED',
      status: 'SELF_REPORTED',
      isFinal: true,
      evidenceUrl: 'https://example.test/acceptance.pdf',
    });
    expect(payload.notes).toContain('[share=true]');

    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).points,
    ).toBe(0);
    expect(await prisma.pointHistory.count({ where: { userId } })).toBe(0);
  });

  it('removes the prediction from pending and reads list/stats back', async () => {
    const pendingResponse = await request(app.getHttpServer())
      .get('/predictions/outcomes/pending-decisions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unwrap(pendingResponse.body)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ predictionResultId })]),
    );

    const listResponse = await request(app.getHttpServer())
      .get('/predictions/outcomes/me?result=ADMITTED&status=SELF_REPORTED')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unwrap(listResponse.body)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: outcomeId, predictionResultId }),
      ]),
    );

    const statsResponse = await request(app.getHttpServer())
      .get('/predictions/outcomes/me/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unwrap(statsResponse.body)).toMatchObject({
      totalReported: 1,
      selfReported: 1,
      verified: 0,
    });
  });

  it('updates the existing self-report instead of creating a duplicate', async () => {
    const response = await request(app.getHttpServer())
      .post('/predictions/outcomes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        predictionResultId,
        result: 'WAITLISTED',
        round: 'RD',
        isFinal: false,
      })
      .expect(201);
    expect(unwrap(response.body)).toMatchObject({
      id: outcomeId,
      result: 'WAITLISTED',
      isFinal: false,
    });
    expect(
      await prisma.predictionOutcomeLabelRecord.count({
        where: {
          predictionResultId,
          reportedBy: userId,
          status: 'SELF_REPORTED',
        },
      }),
    ).toBe(1);
  });

  it('validates evidence uploads before storage is called', async () => {
    await request(app.getHttpServer())
      .post(`/predictions/outcomes/${outcomeId}/evidence`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not an allowed file'), {
        filename: 'proof.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });
});
