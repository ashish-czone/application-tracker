import { SetMetadata } from '@nestjs/common';

export const CAPABILITY_KEY = 'requiredCapability';
export const RequireCapability = (capability: string) => SetMetadata(CAPABILITY_KEY, capability);
