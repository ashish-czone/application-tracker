import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mock auth guard for package-level controller integration tests.
 *
 * Instead of validating JWTs, reads user context from the `x-test-user` header.
 * If the header is missing and the route is not @Public(), throws 401.
 *
 * Usage in tests:
 *   request(httpServer)
 *     .get('/api/v1/tags')
 *     .set(withAuth(['taxonomy.tags.read']))
 */
@Injectable()
export class MockAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const testUserHeader = request.headers['x-test-user'];

    if (!testUserHeader) {
      throw new UnauthorizedException('Missing x-test-user header');
    }

    try {
      request.user = JSON.parse(testUserHeader as string);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid x-test-user header');
    }
  }
}
