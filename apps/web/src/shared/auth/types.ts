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

// JWT payload (decoded from access token — not verified client-side)

export interface JwtPayload {
  userId: string;
  userType: string;
  permissions: string[];
  iat: number;
  exp: number;
}

// Derived auth user (what hooks expose)

export interface AuthUser {
  userId: string;
  userType: string;
  permissions: string[];
}
