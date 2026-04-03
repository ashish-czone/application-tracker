// Request types

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  identifier: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

// Response types

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export interface RefreshTokensResponse {
  accessToken: string;
  refreshToken: string;
}

export interface MessageResponse {
  message: string;
}

// Scoped permissions as stored in JWT (matches backend ScopedPermissions type)
export type ScopedPermissions = Record<string, string>;

// JWT payload (decoded from access token — not verified client-side)

export interface JwtPayload {
  userId: string;
  userType: string;
  permissions: ScopedPermissions;
  iat: number;
  exp: number;
}

// Derived auth user (what hooks expose)

export interface AuthUser {
  userId: string;
  userType: string;
  permissions: ScopedPermissions;
}

// Profile types

export interface UserProfile {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  userType: string;
  createdAt: string;
  roles: { id: string; name: string }[];
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

// OAuth types

export interface OAuthProviderInfo {
  provider: string;
  clientId: string;
  scopes: string[];
}

export interface OAuthLoginRequest {
  code: string;
  redirectUri: string;
}
