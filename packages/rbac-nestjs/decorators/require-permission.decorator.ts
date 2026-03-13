import { SetMetadata } from '@nestjs/common';
import { REQUIRE_PERMISSION_KEY } from '../constants';

export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
