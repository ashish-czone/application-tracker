import { apiClient } from '../helpers/api-client';

export interface LawHandler {
  id: string;
  lawId: string;
  orgEntityId: string;
  clientId: string | null;
  isPrimary: boolean;
}

export interface CreateLawHandlerOptions {
  lawId: string;
  orgEntityId: string;
  clientId?: string;
  isPrimary?: boolean;
}

/**
 * Creates a law-handler row pointing a law at an org-unit. Required before
 * any client can register against the law (per the I20 / I21 / I22
 * handler-integrity guards). Pass `clientId` for a client-specific
 * override; leave it undefined for a global default handler.
 */
export async function createLawHandler(opts: CreateLawHandlerOptions): Promise<LawHandler> {
  return apiClient.post<LawHandler>('/law-handlers', {
    lawId: opts.lawId,
    orgEntityId: opts.orgEntityId,
    clientId: opts.clientId ?? null,
    isPrimary: opts.isPrimary ?? true,
  });
}
