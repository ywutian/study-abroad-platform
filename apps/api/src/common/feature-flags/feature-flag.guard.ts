import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAG_KEY } from './feature-flag.decorator';
import { FeatureFlagService } from './feature-flag.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @FeatureFlag() decorator — allow through
    if (!flagKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const enabled = await this.featureFlagService.isEnabled(flagKey, {
      userId: user?.id,
      role: user?.role,
    });

    if (!enabled) {
      // Return 404 instead of 403 — feature "doesn't exist" rather than "forbidden"
      throw new NotFoundException();
    }

    return true;
  }
}
