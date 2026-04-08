import type { MockEntity, ListColumn, LayoutSection } from '../mock-api';

export function generateContacts(count = 30) {
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivy', 'Jack',
    'Karen', 'Liam', 'Mia', 'Noah', 'Olivia'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Martin'];
  const titles = ['CEO', 'CTO', 'VP Engineering', 'HR Manager', 'Recruiting Lead', 'Director'];

  return Array.from({ length: count }, (_, i) => ({
    id: `contact-${String(i + 1).padStart(3, '0')}`,
    firstName: firstNames[i % firstNames.length],
    lastName: lastNames[i % lastNames.length],
    fullName: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
    email: `${firstNames[i % firstNames.length].toLowerCase()}.${lastNames[i % lastNames.length].toLowerCase()}@client.com`,
    mobile: `+1555${String(3000 + i).padStart(7, '0')}`,
    jobTitle: titles[i % titles.length],
    clientId: `client-${String((i % 5) + 1).padStart(3, '0')}`,
    clientId__label: ['Acme Corp', 'TechVentures', 'GlobalSoft', 'InnovateCo', 'DataDriven'][i % 5],
    createdAt: new Date(2026, 0, i + 1).toISOString(),
    updatedAt: new Date(2026, 0, i + 1).toISOString(),
    createdBy: 'user-001',
    createdBy__label: 'John Doe',
  }));
}

export const contactEntity: MockEntity = {
  entityType: 'contacts',
  singularName: 'Contact',
  pluralName: 'Contacts',
  slug: 'contacts',
  icon: 'contact',
  nameField: 'fullName',
};

export const contactListColumns: ListColumn[] = [
  { fieldKey: 'fullName', label: 'Name', fieldType: 'text', sortable: true, visible: true, order: 1 },
  { fieldKey: 'clientId', label: 'Client', fieldType: 'lookup', sortable: false, visible: true, order: 2, lookupEntity: 'clients' },
  { fieldKey: 'email', label: 'Email', fieldType: 'email', sortable: true, visible: true, order: 3 },
  { fieldKey: 'mobile', label: 'Mobile', fieldType: 'phone', sortable: false, visible: true, order: 4 },
  { fieldKey: 'jobTitle', label: 'Job Title', fieldType: 'text', sortable: false, visible: true, order: 5 },
];

export const contactLayoutSections: LayoutSection[] = [
  {
    id: 'sec-contact-1',
    name: 'Contact Information',
    columns: 2,
    sortOrder: 1,
    isCollapsible: false,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'firstName', label: 'First Name', fieldType: 'text', required: true, isQuickCreate: true, maxLength: 125, columnIndex: 0 },
      { fieldKey: 'lastName', label: 'Last Name', fieldType: 'text', required: true, isQuickCreate: true, maxLength: 125, columnIndex: 1 },
      { fieldKey: 'clientId', label: 'Client', fieldType: 'lookup', required: false, isQuickCreate: true, lookupEntity: 'clients', columnIndex: 0 },
      { fieldKey: 'email', label: 'Email', fieldType: 'email', required: false, isQuickCreate: true, columnIndex: 1 },
      { fieldKey: 'mobile', label: 'Mobile', fieldType: 'phone', required: false, isQuickCreate: true, columnIndex: 0 },
      { fieldKey: 'workPhone', label: 'Work Phone', fieldType: 'phone', required: false, isQuickCreate: true, columnIndex: 1 },
      { fieldKey: 'jobTitle', label: 'Job Title', fieldType: 'text', required: false, isQuickCreate: false, columnIndex: 0 },
    ],
  },
];

export const contactSearchColumns = ['firstName', 'lastName', 'email'];
