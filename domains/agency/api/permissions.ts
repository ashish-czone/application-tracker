export const AGENCY_PERMISSIONS = {} as const;

export type AgencyPermission =
  (typeof AGENCY_PERMISSIONS)[keyof typeof AGENCY_PERMISSIONS];

interface PermissionRegistration {
  module: string;
  action: string;
  description: string;
}

export const AGENCY_PERMISSION_REGISTRATIONS: PermissionRegistration[] = [];
