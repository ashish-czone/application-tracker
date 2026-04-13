import type { Type } from '@nestjs/common';

export interface DomainBackendManifest {
  name: string;
  displayName: string;
  module: Type<unknown>;
}

export interface DomainWebManifest {
  name: string;
  displayName: string;
}
