// User row shape for the users list/grid view. Composes the API user
// record with derived presentation fields (initials, avatar color).

export type UserStatus = 'active' | 'invited' | 'deactivated';

export interface UserRole {
  id: string;
  name: string;
}

export interface UserPosition {
  id: string;
  unitName: string;
  title: string;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
  color: string;
  status: UserStatus;
  roles: UserRole[];
  positions: UserPosition[];
  lastActiveAt: string | null;
  createdAt: string;
}
