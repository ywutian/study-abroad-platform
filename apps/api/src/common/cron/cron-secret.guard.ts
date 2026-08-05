import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

export const CRON_SECRET_HEADER = 'x-cron-secret';

/**
 * Shared-secret auth for `/internal/cron`. Cloud Scheduler sends the secret as
 * a static header (configured by `scripts/ci/sync-cloud-scheduler.mjs` from
 * the Secret Manager secret `cron-secret`).
 *
 * Fail-closed: no `CRON_SECRET` configured → every request is 401 (staging
 * deliberately runs this way — `CRON_DRIVER=http` with no secret and no
 * scheduler jobs means schedules are simply off there). Comparison is over
 * SHA-256 digests so `timingSafeEqual` gets equal-length buffers without
 * leaking the secret's length.
 *
 * Upgrade path if this ever needs to be stronger: Cloud Scheduler OIDC tokens
 * verified with google-auth-library. Not done now — it adds a dependency and a
 * JWKS fetch for an endpoint whose callers we fully control.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('CRON_SECRET');
    // Bare 401, same as a wrong secret: an unauthenticated prober should not
    // be able to tell "no secret configured here" from "wrong secret".
    if (!secret) {
      throw new UnauthorizedException();
    }
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[CRON_SECRET_HEADER];
    if (typeof provided !== 'string' || provided.length === 0) {
      throw new UnauthorizedException();
    }
    const providedDigest = createHash('sha256').update(provided).digest();
    const secretDigest = createHash('sha256').update(secret).digest();
    if (!timingSafeEqual(providedDigest, secretDigest)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
