import { Injectable, Inject } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { SERVICE_AUTH_CONFIG, type ServiceAuthConfig } from '../types';

@Injectable()
export class ServiceAuthClient {
  private readonly algorithm: jwt.Algorithm;
  private readonly tokenTtl: number;

  constructor(
    @Inject(SERVICE_AUTH_CONFIG) private readonly config: ServiceAuthConfig,
  ) {
    this.algorithm = config.algorithm ?? 'RS256';
    this.tokenTtl = config.tokenTtl ?? 300;
  }

  createToken(audience: string, scopes?: string[]): string {
    const payload: Record<string, unknown> = {
      iss: this.config.serviceId,
      aud: audience,
    };

    if (scopes?.length) {
      payload.scopes = scopes;
    }

    return jwt.sign(payload, this.config.privateKey, {
      algorithm: this.algorithm,
      expiresIn: this.tokenTtl,
    });
  }

  getAuthHeaders(audience: string, scopes?: string[]): Record<string, string> {
    return {
      Authorization: `Bearer ${this.createToken(audience, scopes)}`,
    };
  }
}
