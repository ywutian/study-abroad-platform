import { Test, TestingModule } from '@nestjs/testing';
import { ResilienceService, CircuitOpenError, TimeoutError } from './resilience.service';

describe('ResilienceService', () => {
  let service: ResilienceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ResilienceService],
    }).compile();

    service = module.get<ResilienceService>(ResilienceService);
  });

  afterEach(() => {
    // Reset all circuits between tests
    service.resetCircuit('test-service');
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await service.withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const result = await service.withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('ValidationError'));

      await expect(
        service.withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 }),
      ).rejects.toThrow('ValidationError');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max attempts', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('500'));

      await expect(
        service.withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 }),
      ).rejects.toThrow('500');

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('503'))
        .mockRejectedValueOnce(new Error('503'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await service.withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 50,
        maxDelayMs: 200,
      });
      const elapsed = Date.now() - startTime;

      // First retry: 50ms, second retry: 100ms = 150ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(140);
    });
  });

  describe('withTimeout', () => {
    it('should return result if completes within timeout', async () => {
      const fn = jest.fn().mockResolvedValue('fast');

      const result = await service.withTimeout(fn, 1000, 'test-op');

      expect(result).toBe('fast');
    });

    it('should throw TimeoutError if exceeds timeout', async () => {
      const fn = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('slow'), 500)),
      );

      await expect(
        service.withTimeout(fn, 50, 'slow-op'),
      ).rejects.toThrow(TimeoutError);
    });

    it('should include operation name in error', async () => {
      const fn = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('slow'), 500)),
      );

      await expect(
        service.withTimeout(fn, 10, 'my-operation'),
      ).rejects.toThrow('my-operation');
    });
  });

  describe('withCircuitBreaker', () => {
    it('should allow requests when circuit is closed', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await service.withCircuitBreaker('test-service', fn);

      expect(result).toBe('success');
    });

    it('should open circuit after failure threshold', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        await expect(
          service.withCircuitBreaker('test-service', fn, { failureThreshold: 5 }),
        ).rejects.toThrow('fail');
      }

      // Next call should fail with CircuitOpenError
      await expect(
        service.withCircuitBreaker('test-service', fn),
      ).rejects.toThrow(CircuitOpenError);

      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should transition to half-open after reset timeout', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await expect(
          service.withCircuitBreaker('test-service', fn, {
            failureThreshold: 5,
            resetTimeoutMs: 50,
          }),
        ).rejects.toThrow('fail');
      }

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Should allow request (half-open state)
      fn.mockResolvedValue('recovered');
      const result = await service.withCircuitBreaker('test-service', fn);
      expect(result).toBe('recovered');
    });

    it('should close circuit after successful half-open requests', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await expect(
          service.withCircuitBreaker('test-service', fn, {
            failureThreshold: 5,
            resetTimeoutMs: 50,
            halfOpenRequests: 2,
          }),
        ).rejects.toThrow('fail');
      }

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Successful half-open requests
      fn.mockResolvedValue('success');
      await service.withCircuitBreaker('test-service', fn);
      await service.withCircuitBreaker('test-service', fn);

      // Circuit should be closed now
      const status = service.getCircuitStatus('test-service');
      expect(status.state).toBe('CLOSED');
    });
  });

  describe('getCircuitStatus', () => {
    it('should return CLOSED for new circuit', () => {
      const status = service.getCircuitStatus('new-service');

      expect(status.state).toBe('CLOSED');
      expect(status.failures).toBe(0);
      expect(status.isOpen).toBe(false);
    });

    it('should track failures', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        await expect(
          service.withCircuitBreaker('test-service', fn, { failureThreshold: 10 }),
        ).rejects.toThrow();
      }

      const status = service.getCircuitStatus('test-service');
      expect(status.failures).toBe(3);
    });
  });

  describe('resetCircuit', () => {
    it('should reset circuit state', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // Create some failures
      for (let i = 0; i < 3; i++) {
        await expect(
          service.withCircuitBreaker('test-service', fn, { failureThreshold: 10 }),
        ).rejects.toThrow();
      }

      service.resetCircuit('test-service');

      const status = service.getCircuitStatus('test-service');
      expect(status.failures).toBe(0);
      expect(status.state).toBe('CLOSED');
    });
  });

  describe('execute (combined)', () => {
    it('should combine retry, circuit breaker, and timeout', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('503'))
        .mockResolvedValue('success');

      const result = await service.execute('test-service', fn, {
        retry: { maxAttempts: 3, baseDelayMs: 10 },
        timeoutMs: 5000,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect circuit breaker in combined execution', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('500'));

      // Exhaust retries and trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await expect(
          service.execute('test-service', fn, {
            retry: { maxAttempts: 1, baseDelayMs: 1 },
            circuit: { failureThreshold: 5 },
          }),
        ).rejects.toThrow();
      }

      // Circuit should be open now
      await expect(
        service.execute('test-service', fn),
      ).rejects.toThrow(CircuitOpenError);
    });
  });
});


