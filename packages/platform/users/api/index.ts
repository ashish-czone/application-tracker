export { UsersModule } from './users.module';
export { UsersService } from './services/users.service';
export { createUsersEntityConfig } from './users.config';
export type { UsersEntityConfigDeps } from './users.config';
export { USERS_PERMISSIONS } from './permissions';
export {
  USERS_USER_CREATED,
  USERS_USER_UPDATED,
  USERS_USER_DELETED,
  type UserSnapshot,
  type UserCreatedPayload,
  type UserUpdatedPayload,
  type UserDeletedPayload,
} from './events/types';
