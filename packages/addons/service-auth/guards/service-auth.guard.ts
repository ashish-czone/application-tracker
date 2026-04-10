import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { SERVICE_AUTH_CONFIG, type ServiceAuthConfig, type ServiceTokenPayload } from '../types';

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  private readonly algorithm: jwt.Algorithm;

  constructor(
    @Inject(SERVICE_AUTH_CONFIG) private readonly config: ServiceAuthConfig,
  ) {
    this.algorithm = config.algorithm ?? 'RS256';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing service authorization');
    }

    const token = authHeader.slice(7);

    // Decode without verification to read iss claim
    const decoded = jwt.decode(token) as ServiceTokenPayload | null;
    if (!decoded?.iss) {
      throw new UnauthorizedException('Invalid service token');
    }

    // Look up the calling service's public key
    const publicKey = this.config.trustedServices[decoded.iss];
    if (!publicKey) {
      throw new ForbiddenException(`Untrusted service: ${decoded.iss}`);
    }

    try {
      const verified = jwt.verify(token, publicKey, {
        algorithms: [this.algorithm],
        audience: this.config.serviceId,
      }) as ServiceTokenPayload;

      request.serviceAuth = verified;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired service token');
    }
  }
}
