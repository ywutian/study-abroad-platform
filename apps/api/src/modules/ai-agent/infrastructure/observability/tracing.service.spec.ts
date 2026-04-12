import { Test, TestingModule } from '@nestjs/testing';
import { TracingService } from './tracing.service';

describe('TracingService', () => {
  let service: TracingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TracingService],
    }).compile();

    service = module.get(TracingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should start and end a span', () => {
    const span = service.startSpan('test-operation');
    expect(span).toHaveProperty('traceId');
    expect(span).toHaveProperty('spanId');
    expect(span.name).toBe('test-operation');
    expect(span.status).toBe('ok');

    service.endSpan(span);
    expect(span.endTime).toBeDefined();
    expect(span.duration).toBeGreaterThanOrEqual(0);
  });

  it('should add tags to a span', () => {
    const span = service.startSpan('tagged-op');
    service.addTag(span, 'userId', 'user-1');
    expect(span.tags.userId).toBe('user-1');
    service.endSpan(span);
  });

  it('should add logs to a span', () => {
    const span = service.startSpan('logged-op');
    service.addLog(span, 'info', 'something happened');
    expect(span.logs.length).toBe(1);
    service.endSpan(span);
  });

  it('should set error on a span', () => {
    const span = service.startSpan('error-op');
    service.setError(span, new Error('test error'));
    expect(span.status).toBe('error');
    service.endSpan(span);
  });

  it('should get recent spans', () => {
    const span = service.startSpan('recent-op');
    service.endSpan(span);
    const recent = service.getRecentSpans(10);
    expect(recent.length).toBeGreaterThan(0);
  });

  it('should retrieve trace by traceId', () => {
    const span = service.startSpan('traceable-op');
    service.endSpan(span);
    const trace = service.getTrace(span.traceId);
    expect(trace.length).toBeGreaterThan(0);
  });
});
