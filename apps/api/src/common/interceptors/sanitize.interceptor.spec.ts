import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { SanitizeInterceptor } from './sanitize.interceptor';

// Mock the stripHtml utility - strip ALL html tags
jest.mock('../utils/sanitize', () => ({
  stripHtml: jest.fn((input: string) => input.replace(/<[^>]*>/g, '')),
}));

describe('SanitizeInterceptor', () => {
  let interceptor: SanitizeInterceptor;
  let mockNext: CallHandler;

  beforeEach(() => {
    interceptor = new SanitizeInterceptor();
    mockNext = { handle: jest.fn().mockReturnValue(of('response')) };
  });

  function createMockContext(body: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ body }),
      }),
    } as unknown as ExecutionContext;
  }

  // -----------------------------------------------------------------------

  it('should strip HTML tags from string fields in request body', () => {
    const body = {
      name: '<b>John</b>',
      bio: '<script>alert("xss")</script>Hello',
    };
    const context = createMockContext(body);

    interceptor.intercept(context, mockNext);

    expect(body.name).toBe('John');
    expect(body.bio).toBe('alert("xss")Hello');
  });

  it('should recursively sanitize nested objects', () => {
    const body = {
      profile: {
        firstName: '<em>Jane</em>',
        address: {
          city: '<div>Beijing</div>',
        },
      },
    };
    const context = createMockContext(body);

    interceptor.intercept(context, mockNext);

    expect(body.profile.firstName).toBe('Jane');
    expect(body.profile.address.city).toBe('Beijing');
  });

  it('should preserve non-string fields (numbers, booleans, arrays of numbers)', () => {
    const body = {
      age: 25,
      active: true,
      scores: [100, 200],
      name: '<i>Test</i>',
    };
    const context = createMockContext(body);

    interceptor.intercept(context, mockNext);

    expect(body.age).toBe(25);
    expect(body.active).toBe(true);
    expect(body.scores).toEqual([100, 200]);
    expect(body.name).toBe('Test');
  });

  it('should handle null body gracefully without throwing', () => {
    const context = createMockContext(null);

    expect(() => interceptor.intercept(context, mockNext)).not.toThrow();
  });

  it('should handle undefined body gracefully', () => {
    const context = createMockContext(undefined);

    expect(() => interceptor.intercept(context, mockNext)).not.toThrow();
  });

  it('should call next.handle() and return its observable', (done) => {
    const context = createMockContext({ name: 'clean' });

    const result$ = interceptor.intercept(context, mockNext);

    expect(mockNext.handle).toHaveBeenCalled();
    result$.subscribe({
      next: (value) => {
        expect(value).toBe('response');
      },
      complete: () => done(),
    });
  });

  it('should sanitize string values inside arrays', () => {
    const body = {
      tags: ['<b>tag1</b>', '<script>bad</script>tag2'],
    };
    const context = createMockContext(body);

    interceptor.intercept(context, mockNext);

    // Arrays are objects, so the interceptor recurses into them.
    // Array indices are object keys, so string elements get sanitized.
    expect(body.tags[0]).toBe('tag1');
    expect(body.tags[1]).toBe('badtag2');
  });
});
