import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { registerAndLogin, unwrap } from './helpers/auth.helper';

describe('Resume closure (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let otherToken: string;
  let resumeId: string;
  let duplicateId: string;
  let sectionIds: string[] = [];

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
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('creates a resume with native default sections', async () => {
    const response = await request(app.getHttpServer())
      .post('/resumes')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Closure Resume',
        type: 'COLLEGE_APPLICATION',
        language: 'en',
      })
      .expect(201);

    const resume = unwrap(response.body);
    resumeId = resume.id;
    sectionIds = resume.sections.map((section: { id: string }) => section.id);
    expect(resume.title).toBe('Closure Resume');
    expect(sectionIds.length).toBeGreaterThan(1);
  });

  it('reads the created resume back from list and detail endpoints', async () => {
    const listResponse = await request(app.getHttpServer())
      .get('/resumes')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(unwrap(listResponse.body)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: resumeId })]),
    );

    const detailResponse = await request(app.getHttpServer())
      .get(`/resumes/${resumeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(unwrap(detailResponse.body).sections).toHaveLength(
      sectionIds.length,
    );
  });

  it('updates metadata, section visibility and section order persistently', async () => {
    await request(app.getHttpServer())
      .put(`/resumes/${resumeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Closure Resume Updated', status: 'ACTIVE' })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/resumes/${resumeId}/sections/${sectionIds[0]}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isVisible: false })
      .expect(200);

    const reversed = [...sectionIds].reverse();
    await request(app.getHttpServer())
      .put(`/resumes/${resumeId}/sections/reorder`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sectionIds: reversed })
      .expect(200);

    const detailResponse = await request(app.getHttpServer())
      .get(`/resumes/${resumeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const resume = unwrap(detailResponse.body);
    expect(resume.title).toBe('Closure Resume Updated');
    expect(resume.status).toBe('ACTIVE');
    expect(
      resume.sections.map((section: { id: string }) => section.id),
    ).toEqual(reversed);
    expect(
      resume.sections.find(
        (section: { id: string }) => section.id === sectionIds[0],
      ).isVisible,
    ).toBe(false);
  });

  it('duplicates the complete resume and isolates it from another user', async () => {
    const duplicateResponse = await request(app.getHttpServer())
      .post(`/resumes/${resumeId}/duplicate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const duplicate = unwrap(duplicateResponse.body);
    duplicateId = duplicate.id;
    expect(duplicate.title).toContain('(Copy)');
    expect(duplicate.sections).toHaveLength(sectionIds.length);

    await request(app.getHttpServer())
      .get(`/resumes/${duplicateId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('deletes a resume and makes it unreadable', async () => {
    await request(app.getHttpServer())
      .delete(`/resumes/${resumeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/resumes/${resumeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });
});
