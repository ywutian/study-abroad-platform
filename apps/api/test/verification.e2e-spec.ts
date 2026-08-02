import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { extractCookie, registerAndLogin, unwrap } from './helpers/auth.helper';

describe('Verification closure (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userToken: string;
  let otherToken: string;
  let adminToken: string;
  let userId: string;
  let caseId: string;
  let verificationId: string;

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

    const user = await registerAndLogin(app);
    userToken = user.accessToken;
    userId = (
      await prisma.user.findUniqueOrThrow({ where: { email: user.email } })
    ).id;
    otherToken = (await registerAndLogin(app)).accessToken;

    const adminCredentials = {
      email: `verification-admin-${Date.now()}@test.com`,
      password: 'TestPassword123!',
    };
    await registerAndLogin(app, adminCredentials);
    await prisma.user.update({
      where: { email: adminCredentials.email },
      data: { role: 'ADMIN' },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send(adminCredentials)
      .expect(200);
    adminToken = unwrap(adminLogin.body).accessToken;
    expect(extractCookie(adminLogin, 'refreshToken')).toBeDefined();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const school = await prisma.school.create({
      data: {
        name: `Verification School ${suffix}`,
        nameNorm: `verification school ${suffix}`,
      },
    });
    const admissionCase = await prisma.admissionCase.create({
      data: {
        userId,
        schoolId: school.id,
        year: 2027,
        round: 'RD',
        result: 'ADMITTED',
        tags: [],
        apSubjects: [],
        demographicTags: [],
        source: 'e2e',
      },
    });
    caseId = admissionCase.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('starts unverified and exposes the owned case through /cases/me', async () => {
    const statusResponse = await request(app.getHttpServer())
      .get('/verifications/status')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(unwrap(statusResponse.body)).toMatchObject({
      emailVerified: true,
      identityVerified: false,
    });

    const casesResponse = await request(app.getHttpServer())
      .get('/cases/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const casesPayload = unwrap(casesResponse.body);
    const cases = Array.isArray(casesPayload)
      ? casesPayload
      : casesPayload.items;
    expect(cases).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: caseId })]),
    );
  });

  it('rejects another user submitting proof for a case they do not own', async () => {
    await request(app.getHttpServer())
      .post('/verifications')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        caseId,
        proofType: 'offer_letter',
        proofData: 'data:application/pdf;base64,JVBERi0xLjQ=',
      })
      .expect(403);
  });

  it('submits a lowercase proof type and reads the pending request back', async () => {
    const submitResponse = await request(app.getHttpServer())
      .post('/verifications')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        caseId,
        proofType: 'offer_letter',
        proofData: 'data:application/pdf;base64,JVBERi0xLjQ=',
      })
      .expect(201);
    const verification = unwrap(submitResponse.body);
    verificationId = verification.id;
    expect(verification).toMatchObject({
      caseId,
      proofType: 'offer_letter',
      status: 'PENDING',
    });

    const myResponse = await request(app.getHttpServer())
      .get('/verifications/my')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(unwrap(myResponse.body)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: verificationId, status: 'PENDING' }),
      ]),
    );
  });

  it('lets an admin approve and updates status without awarding points', async () => {
    await request(app.getHttpServer())
      .post(`/verifications/${verificationId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve', note: 'Verified by closure E2E' })
      .expect(201);

    const statusResponse = await request(app.getHttpServer())
      .get('/verifications/status')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(unwrap(statusResponse.body).identityVerified).toBe(true);

    const [storedCase, storedUser] = await Promise.all([
      prisma.admissionCase.findUniqueOrThrow({ where: { id: caseId } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    expect(storedCase.isVerified).toBe(true);
    expect(storedUser.points).toBe(0);
  });
});
