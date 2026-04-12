import { Test, TestingModule } from '@nestjs/testing';
import { FallbackService } from './fallback.service';

describe('FallbackService', () => {
  let service: FallbackService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FallbackService],
    }).compile();

    service = module.get(FallbackService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return fallback response with message', () => {
    const response = service.getFallbackResponse(new Error('test'), undefined, {
      locale: 'en',
    });
    expect(response).toHaveProperty('message');
    expect(response.message).toBeTruthy();
  });

  it('should return Chinese fallback for zh locale', () => {
    const response = service.getFallbackResponse(new Error('test'), undefined, {
      locale: 'zh',
    });
    expect(response.message).toBeTruthy();
  });

  it('should return agent-specific fallback for essay agent', () => {
    const response = service.getFallbackResponse(
      new Error('test'),
      'essay' as any,
      { locale: 'en' },
    );
    expect(response).toHaveProperty('message');
  });

  it('should categorize errors', () => {
    expect(service.categorizeError(new Error('timeout'))).toBe('timeout');
    expect(service.categorizeError(new Error('rate limit'))).toBe('rate_limit');
    expect(service.categorizeError(new Error('network'))).toBe('network');
    expect(service.categorizeError(new Error('unknown thing'))).toBe('unknown');
  });

  it('should determine retry eligibility', () => {
    expect(service.shouldRetry(new Error('timeout'))).toBe(true);
    expect(service.shouldRetry(new Error('network'))).toBe(true);
    expect(service.shouldRetry(new Error('rate limit'))).toBe(false);
  });

  it('should provide user-friendly error messages', () => {
    const msg = service.getUserFriendlyMessage(new Error('timeout'), 'en');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});
