import { AiAgentModule } from './ai-agent.module';
import {
  RequestContextMiddleware,
  UserContextMiddleware,
} from './infrastructure/context/request-context';
import { AgentSecurityMiddleware } from './middleware/security.middleware';

/**
 * The middlewares are registered.
 *
 * `UserContextMiddleware` existed, was correct, and was never applied — so the
 * request context it fills carried no user, and the agent audit log recorded
 * every entry with `userId: undefined`. Nothing failed: the accessors answer
 * `undefined` cleanly, so the gap was only visible by reading an audit row.
 *
 * A unit test cannot prove the middleware runs against a real request, but it
 * can prove the module still asks for it. That is the assertion that would have
 * caught this, and the one that stops it coming back.
 */
describe('AiAgentModule middleware wiring', () => {
  const capture = () => {
    const applied: unknown[][] = [];
    const consumer = {
      apply: (...m: unknown[]) => {
        applied.push(m);
        return { forRoutes: () => consumer };
      },
    };
    new AiAgentModule().configure(consumer as never);
    return applied;
  };

  it('applies the request scope and the user context together', () => {
    const applied = capture();
    const contextChain = applied.find((m) =>
      m.includes(RequestContextMiddleware),
    );

    expect(contextChain).toBeDefined();
    // Both, or the context is opened and left empty.
    expect(contextChain).toContain(UserContextMiddleware);
  });

  it('puts the scope before the user context', () => {
    // UserContextMiddleware writes into the AsyncLocalStorage store that
    // RequestContextMiddleware opens. Reversed, its writes go nowhere.
    const chain = capture().find((m) => m.includes(RequestContextMiddleware))!;

    expect(chain.indexOf(RequestContextMiddleware)).toBeLessThan(
      chain.indexOf(UserContextMiddleware),
    );
  });

  it('still applies the agent security middleware to the NL routes', () => {
    expect(capture().some((m) => m.includes(AgentSecurityMiddleware))).toBe(
      true,
    );
  });
});
