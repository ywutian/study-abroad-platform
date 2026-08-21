import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get(MetricsService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should record a request', () => {
    service.recordRequest('school', 'success');
    // No throw = success; metrics are internal
  });

  it('should record LLM latency', () => {
    service.recordLLMLatency(150);
    // Should not throw
  });

  it('should record tool latency', () => {
    service.recordToolLatency('search_schools', 80);
    // Should not throw
  });

  it('should record token usage', () => {
    service.recordTokens(100, 200, 'gpt-4o-mini');
    // Should not throw
  });

  it('should record errors', () => {
    service.recordError('timeout', 'school');
    // Should not throw
  });

  it('exports Agent Harness lifecycle and cleanup counters', () => {
    service.recordHarnessEvent('token_budget_exceeded');
    service.recordHarnessCleanup('traces', 3);

    expect(service.getPrometheusFormat()).toContain(
      'agent_harness_events_total{event="token_budget_exceeded"} 1',
    );
    expect(service.getPrometheusFormat()).toContain(
      'agent_harness_cleanup_total{resource="traces"} 3',
    );
  });
});
