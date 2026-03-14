export { AuthNestjsModule } from './auth-nestjs.module';
export { AuthGuard } from './guards/auth.guard';
export { AuthService } from './services/auth.service';
export { Public } from './decorators/public.decorator';
export { CurrentIdentity } from './decorators/current-identity.decorator';
export { IS_PUBLIC_KEY, AUTH_MODULE_CONFIG, AUTH_CONFIGS_MAP } from './constants';
export type { AuthModuleConfig } from '@packages/auth';
