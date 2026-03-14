import type { Response, Request } from 'express';

export function refreshCookieName(entityName: string): string {
  return `${entityName}_refresh_token`;
}

export function setRefreshCookie(res: Response, entityName: string, token: string) {
  res.cookie(refreshCookieName(entityName), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function getRefreshCookie(req: Request, entityName: string): string | undefined {
  return req.cookies?.[refreshCookieName(entityName)];
}

export function clearRefreshCookie(res: Response, entityName: string) {
  res.clearCookie(refreshCookieName(entityName));
}
