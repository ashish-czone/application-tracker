import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken, TokenExpiredError, InvalidTokenError } from '@packages/auth';
import type { TokenPayload } from '@packages/auth';
import { IS_PUBLIC_KEY, AUTH_CONFIGS_MAP } from '../constants';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    const token = parts[1];

    // Try each registered config to find the right one
    let payload: TokenPayload | null = null;
    for (const [, config] of AUTH_CONFIGS_MAP) {
      try {
        payload = verifyToken(token, config.jwtSecret);
        break;
      } catch {
        continue;
      }
    }

    if (!payload) {
      // Try to verify against any config to get a specific error
      const firstConfig = AUTH_CONFIGS_MAP.values().next().value;
      if (firstConfig) {
        try {
          verifyToken(token, firstConfig.jwtSecret);
        } catch (error) {
          if (error instanceof TokenExpiredError) {
            throw new UnauthorizedException('Token has expired');
          }
        }
      }
      throw new UnauthorizedException('Invalid token');
    }

    const config = AUTH_CONFIGS_MAP.get(payload.entityName);
    if (!config) {
      throw new UnauthorizedException('Unknown auth context');
    }

    const userDelegate = config.getUserDelegate();
    const user = await userDelegate.findUnique({ where: { id: payload.sub } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check soft-delete
    if ('deletedAt' in user && (user as Record<string, unknown>).deletedAt !== null) {
      throw new UnauthorizedException('User account is deactivated');
    }

    request.user = user;
    request.authEntityName = payload.entityName;
    return true;
  }
}
