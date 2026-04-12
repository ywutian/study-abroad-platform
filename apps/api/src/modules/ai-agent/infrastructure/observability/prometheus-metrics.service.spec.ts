import { Test, TestingModule } from '@nestjs/testing';
import { PrometheusMetricsService } from './prometheus-metrics.service';
import { ConfigService } from '@nestjs/config';

describe('PrometheusMetricsService', () => {
  let service: PrometheusMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrometheusMetricsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(PrometheusMetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register and increment a counter', () => {
    service.registerCounter('test_counter', 'A test counter', ['method']);
    service.incCounter('test_counter', { method: 'GET' });
    // Should not throw
  });

  it('should register and set a gauge', () => {
    service.registerGauge('test_gauge', 'A test gauge', ['status']);
    service.setGauge('test_gauge', 42, { status: 'active' });
    // Should not throw
  });

  it('should register a histogram', () => {
    service.registerHistogram('test_histogram', 'A test histogram', ['op'], {
      buckets: [10, 50, 100, 500],
    });
    // Should not throw
  });
});
