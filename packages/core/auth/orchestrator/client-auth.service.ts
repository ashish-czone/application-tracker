import { Injectable } from '@nestjs/common';
import { AuthOrchestratorService } from './auth-orchestrator.service';

const USER_TYPE = 'client';

@Injectable()
export class ClientAuthService extends AuthOrchestratorService {
  protected readonly userType = USER_TYPE;

  async clientRegister(data: { email: string; firstName: string; lastName: string; password: string }) {
    return this.register(data, USER_TYPE);
  }

  async clientLogin(identifier: string, password: string) {
    return this.login(identifier, password, USER_TYPE);
  }

  async clientRefresh(refreshToken: string) {
    return this.refresh(refreshToken, USER_TYPE);
  }

  async clientOAuthLogin(provider: string, code: string, redirectUri: string) {
    return this.loginWithProvider(provider, { provider, code, redirectUri }, USER_TYPE);
  }
}
