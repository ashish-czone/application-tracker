import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ConfigurableThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.DISABLE_THROTTLE === 'true') {
      return true;
    }
    return super.canActivate(context);
  }
}
