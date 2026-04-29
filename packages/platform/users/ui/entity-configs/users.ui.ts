import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const USERS_UI_CONFIG: EntityUIConfig = {
  entityType: 'users',
  presentation: {
    singularName: 'User',
    pluralName: 'Users',
    subtitleField: 'email',
    icon: 'User',
    navGroup: 'admin',
    navOrder: 10,
    createMode: 'page',
  },
  fieldUI: {
    email: { label: 'Email' },
    firstName: { label: 'First Name' },
    lastName: { label: 'Last Name' },
    phone: { label: 'Phone' },
    userType: { label: 'User Type' },
    password: { label: 'Password', uiType: 'password' },
  },
  formLayout: {
    sections: [
      { name: 'User', fields: ['email', 'firstName', 'lastName', 'phone', 'userType'] },
    ],
  },
  listColumns: [
    { fieldKey: 'email', visible: true, order: 1 },
    { fieldKey: 'firstName', visible: true, order: 2 },
    { fieldKey: 'lastName', visible: true, order: 3 },
    { fieldKey: 'phone', visible: true, order: 4 },
    { fieldKey: 'userType', visible: true, order: 5 },
  ],
};
