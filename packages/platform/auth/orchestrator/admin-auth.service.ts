import { Injectable } from '@nestjs/common';
import { AuthOrchestratorService } from './auth-orchestrator.service';

const USER_TYPE = 'admin';

@Injectable()
export class AdminAuthService extends AuthOrchestratorService {
  protected readonly userType = USER_TYPE;

  async adminLogin(identifier: string, password: string) {
    return this.login(identifier, password, USER_TYPE);
  }

  async adminRefresh(refreshToken: string) {
    return this.refresh(refreshToken, USER_TYPE);
  }

  async adminOAuthLogin(provider: string, code: string, redirectUri: string) {
    return this.loginWithProvider(provider, { provider, code, redirectUri }, USER_TYPE);
  }
}
