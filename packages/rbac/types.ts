export interface Role {
  id: string;
  name: string;
  userType: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  name: string;
}

export interface PermissionRegistryEntry {
  module: string;
  action: string;
  description: string;
}
