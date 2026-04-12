import { Test, TestingModule } from '@nestjs/testing';
import { OpenTelemetryService } from './opentelemetry.service';
import { ConfigService } from '@nestjs/config';

describe('OpenTelemetryService', () => {
  let service: OpenTelemetryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenTelemetryService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const overrides: Record<string, string> = {
                  OTEL_ENABLED: 'true',
                  OTEL_SAMPLING_RATIO: '1.0',
                  OTEL_SERVICE_NAME: 'test-service',
                };
                return overrides[key] ?? defaultValue;
              }),
          },
        },
      ],
    }).compile();

    service = module.get(OpenTelemetryService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create and end a span', () => {
    const builder = service.startSpan('test-operation');
    expect(builder).toBeDefined();

    const ctx = builder.getContext();
    expect(ctx).toHaveProperty('traceId');
    expect(ctx).toHaveProperty('spanId');

    const ended = builder.end();
    expect(ended.endTime).toBeDefined();
  });
});
