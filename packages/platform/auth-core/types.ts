export interface JwtPayload {
  userId: string;
  [key: string]: unknown;
}
