import { Injectable } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import type { AuthAdapter, AuthAdapterResult } from './auth-adapter.interface';

@Injectable()
export class PasswordAuthAdapter implements AuthAdapter {
  readonly provider = 'password';

  constructor(private readonly authService: AuthService) {}

  async authenticate(credentials: Record<string, unknown>): Promise<AuthAdapterResult> {
    const { identifier, password } = credentials as { identifier: string; password: string };
    const { userId } = await this.authService.verifyPasswordCredential(identifier, password);

    return {
      userId,
      email: identifier,
      provider: 'password',
      providerIdentifier: identifier,
      isNewUser: false,
      isNewCredential: false,
    };
  }
}
