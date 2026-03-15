import { Injectable } from '@nestjs/common';
import { BaseAuthOrchestratorService } from './base-auth-orchestrator.service';

const USER_TYPE = 'admin';

@Injectable()
export class AdminAuthService extends BaseAuthOrchestratorService {
  async adminLogin(identifier: string, password: string) {
    return this.login(identifier, password, USER_TYPE);
  }

  async adminRefresh(refreshToken: string) {
    return this.refresh(refreshToken, USER_TYPE);
  }
}
