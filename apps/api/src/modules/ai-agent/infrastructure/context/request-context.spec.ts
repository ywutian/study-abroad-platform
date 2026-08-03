import { Request, Response } from 'express';
import {
  RequestContextMiddleware,
  UserContextMiddleware,
  requestContext,
  getCurrentUserId,
  getCurrentUserRole,
} from './request-context';

/**
 * The request context carries who is asking.
 *
 * Two middlewares build it: RequestContextMiddleware opens the
 * AsyncLocalStorage scope, and UserContextMiddleware fills in the user — it has
 * to run second, after the auth guard has put `req.user` on the request.
 *
 * Registering only the first one leaves `userId`, `userRole` and `isVip`
 * permanently undefined while every accessor keeps returning cleanly, which is
 * how the agent audit log spent its life recording entries with no subject.
 * These tests pin the contract; `ai-agent.module.spec.ts` pins the wiring.
 */
describe('request context', () => {
  const mkReq = (user?: unknown) =>
    ({
      path: '/ai-agent/chat',
      method: 'POST',
      headers: {},
      socket: {},
      user,
    }) as unknown as Request;

  // RequestContextMiddleware sets a header and subscribes to 'finish'.
  const res = {
    setHeader: jest.fn(),
    on: jest.fn(),
    statusCode: 200,
  } as unknown as Response;

  it('exposes the caller once both middlewares have run', () => {
    const scope = new RequestContextMiddleware();
    const user = new UserContextMiddleware();

    let seen: { id?: string; role?: string; isVip?: boolean } = {};
    scope.use(mkReq({ sub: 'user-1', role: 'VERIFIED' }), res, () => {
      user.use(mkReq({ sub: 'user-1', role: 'VERIFIED' }), res, () => {
        seen = {
          id: getCurrentUserId(),
          role: getCurrentUserRole(),
          isVip: requestContext.get()?.isVip,
        };
      });
    });

    expect(seen.id).toBe('user-1');
    expect(seen.role).toBe('VERIFIED');
    expect(seen.isVip).toBe(false);
  });

  it('marks ADMIN and SUPER_ADMIN as elevated', () => {
    const scope = new RequestContextMiddleware();
    const user = new UserContextMiddleware();
    const elevated: boolean[] = [];

    for (const role of ['ADMIN', 'SUPER_ADMIN', 'USER']) {
      scope.use(mkReq(), res, () => {
        user.use(mkReq({ sub: 'u', role }), res, () => {
          elevated.push(requestContext.get()?.isVip === true);
        });
      });
    }

    expect(elevated).toEqual([true, true, false]);
  });

  it('leaves the caller undefined when only the scope middleware runs', () => {
    // The state this repo was actually in. Nothing throws, nothing logs — the
    // accessors just answer undefined forever, so a missing registration is
    // invisible until someone reads an audit row.
    const scope = new RequestContextMiddleware();

    let seen: { id?: string; role?: string } = {};
    scope.use(mkReq({ sub: 'user-1', role: 'VERIFIED' }), res, () => {
      seen = { id: getCurrentUserId(), role: getCurrentUserRole() };
    });

    expect(seen.id).toBeUndefined();
    expect(seen.role).toBeUndefined();
  });

  it('does not fabricate a caller for an unauthenticated request', () => {
    const scope = new RequestContextMiddleware();
    const user = new UserContextMiddleware();

    let seen: { id?: string; role?: string } = {};
    scope.use(mkReq(), res, () => {
      user.use(mkReq(undefined), res, () => {
        seen = { id: getCurrentUserId(), role: getCurrentUserRole() };
      });
    });

    expect(seen.id).toBeUndefined();
    expect(seen.role).toBeUndefined();
  });
});
