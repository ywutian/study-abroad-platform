import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { LLMService } from '../src/modules/ai-agent/core/llm.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerAndLogin, unwrap } from './helpers/auth.helper';

describe('Free AI feature closure (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let recommendationId: string;
  let schoolNames: string[];

  const llm = {
    chatSimpleGuarded: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LLMService)
      .useValue(llm)
      .compile();

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
        gpa: 3.85,
        gpaScale: 4,
        targetMajor: 'Computer Science',
        nationality: 'US',
      })
      .expect(200);
    await request(app.getHttpServer())
      .post('/profiles/me/test-scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'SAT', score: 1450 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/profiles/me/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Robotics Club',
        category: 'ACADEMIC',
        role: 'President',
        description: 'Led a student robotics team.',
      })
      .expect(201);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    schoolNames = Array.from(
      { length: 5 },
      (_, index) => `AI Closure School ${index + 1} ${suffix}`,
    );
    await prisma.school.createMany({
      data: schoolNames.map((name, index) => ({
        name,
        nameNorm: name.toLowerCase(),
        acceptanceRate: 15 + index * 5,
        satAvg: 1400 + index * 10,
      })),
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('allows a complete zero-point profile to generate recommendations', async () => {
    const preflightResponse = await request(app.getHttpServer())
      .get('/recommendations/preflight')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unwrap(preflightResponse.body)).toMatchObject({
      canGenerate: true,
      points: 0,
      profileComplete: true,
      missingFields: [],
    });

    llm.chatSimpleGuarded.mockResolvedValueOnce(
      JSON.stringify({
        recommendations: schoolNames.map((schoolName, index) => ({
          schoolName,
          tier: index < 2 ? 'reach' : index < 4 ? 'match' : 'safety',
          estimatedProbability: 25 + index * 10,
          fitScore: 90 - index,
          recommendedMajors: ['Computer Science'],
          reasons: ['Strong academic fit'],
          concerns: ['Selective admissions'],
        })),
        analysis: {
          strengths: ['Strong academics'],
          weaknesses: ['Limited awards'],
          improvementTips: ['Deepen project impact'],
        },
        summary: 'A balanced five-school list.',
        summerPrograms: [],
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/recommendations')
      .set('Authorization', `Bearer ${token}`)
      .send({ schoolCount: 5, preferredMajors: ['Computer Science'] })
      .expect(201);
    const payload = unwrap(response.body);
    recommendationId = payload.id;
    expect(payload.recommendations).toHaveLength(5);
    expect(
      payload.recommendations.every(
        (item: { schoolId?: string }) => item.schoolId,
      ),
    ).toBe(true);
    expect(payload.summary).toBe('A balanced five-school list.');

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(storedUser.points).toBe(0);
    expect(await prisma.pointHistory.count({ where: { userId } })).toBe(0);
  });

  it('reads the recommendation from history/detail and deletes it', async () => {
    const historyResponse = await request(app.getHttpServer())
      .get('/recommendations/history')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unwrap(historyResponse.body)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: recommendationId,
          summary: 'A balanced five-school list.',
        }),
      ]),
    );

    const detailResponse = await request(app.getHttpServer())
      .get(`/recommendations/${recommendationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unwrap(detailResponse.body).recommendations).toHaveLength(5);

    await request(app.getHttpServer())
      .delete(`/recommendations/${recommendationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/recommendations/${recommendationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('runs essay brainstorming at zero points and preserves the response contract', async () => {
    llm.chatSimpleGuarded.mockResolvedValueOnce(
      JSON.stringify({
        ideas: [
          {
            title: 'Build, fail, rebuild',
            description: 'Use the robotics iteration as a growth narrative.',
            suitableFor: 'Common App',
          },
        ],
        overallAdvice: 'Center the story on a specific moment and reflection.',
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/essay-ai/brainstorm')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Describe a challenge that changed how you think.',
        background: 'Robotics team captain',
        school: schoolNames[0],
        major: 'Computer Science',
      })
      .expect(201);
    const payload = unwrap(response.body);
    expect(payload).toMatchObject({
      ideas: [
        expect.objectContaining({
          title: 'Build, fail, rebuild',
          suitableFor: 'Common App',
        }),
      ],
      overallAdvice: 'Center the story on a specific moment and reflection.',
    });
    expect(payload.tokenUsed).toEqual(expect.any(Number));

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(storedUser.points).toBe(0);
    expect(await prisma.pointHistory.count({ where: { userId } })).toBe(0);
  });
});
