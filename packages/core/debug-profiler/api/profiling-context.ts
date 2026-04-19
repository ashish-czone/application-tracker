import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { QueryEntry, RequestProfile } from './types';

@Injectable()
export class ProfilingContextStore {
  private readonly als = new AsyncLocalStorage<RequestProfile>();

  run<R>(profile: RequestProfile, fn: () => R): R {
    return this.als.run(profile, fn);
  }

  current(): RequestProfile | undefined {
    return this.als.getStore();
  }

  recordQuery(entry: QueryEntry): void {
    const profile = this.als.getStore();
    if (!profile) return;
    profile.queries.push(entry);
  }
}
