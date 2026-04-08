import type { MockEntity, ListColumn, LayoutSection } from '../mock-api';

const INDUSTRIES = ['technology', 'healthcare', 'finance', 'education', 'manufacturing', 'retail', 'consulting', 'media'];

export function generateClients(count = 30) {
  const names = [
    'Acme Corp', 'TechVentures', 'GlobalSoft', 'InnovateCo', 'DataDriven',
    'CloudFirst', 'NetWorks Inc', 'Digital Edge', 'Smart Systems', 'Apex Solutions',
    'Fusion Labs', 'Quantum Tech', 'Stellar Group', 'Vertex Inc', 'Nexus Corp',
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `client-${String(i + 1).padStart(3, '0')}`,
    clientName: names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : ''),
    industry: INDUSTRIES[i % INDUSTRIES.length],
    contactNumber: `+1555${String(2000 + i).padStart(7, '0')}`,
    website: `https://${names[i % names.length].toLowerCase().replace(/\s+/g, '')}.com`,
    contactsCount: i % 6,
    jobOpeningsCount: i % 4,
    email: `info@${names[i % names.length].toLowerCase().replace(/\s+/g, '')}.com`,
    createdAt: new Date(2026, 0, i + 1).toISOString(),
    updatedAt: new Date(2026, 0, i + 1).toISOString(),
    createdBy: 'user-001',
    createdBy__label: 'John Doe',
  }));
}

export const clientEntity: MockEntity = {
  entityType: 'clients',
  singularName: 'Client',
  pluralName: 'Clients',
  slug: 'clients',
  icon: 'building-2',
  nameField: 'clientName',
  relationships: [
    { name: 'contacts', type: 'hasMany', targetEntity: 'contacts', foreignKey: 'clientId', label: 'Contacts' },
    { name: 'jobOpenings', type: 'hasMany', targetEntity: 'job_openings', foreignKey: 'clientId', label: 'Job Openings' },
  ],
};

export const clientListColumns: ListColumn[] = [
  { fieldKey: 'clientName', label: 'Client Name', fieldType: 'text', sortable: true, visible: true, order: 1 },
  {
    fieldKey: 'industry', label: 'Industry', fieldType: 'picklist', sortable: true, visible: true, order: 2,
    operators: ['eq', 'neq'],
    picklistOptions: INDUSTRIES.map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s })),
  },
  { fieldKey: 'contactNumber', label: 'Contact Number', fieldType: 'phone', sortable: false, visible: true, order: 3 },
  { fieldKey: 'website', label: 'Website', fieldType: 'url', sortable: false, visible: true, order: 4 },
  {
    fieldKey: 'contactsCount', label: 'Contacts', fieldType: 'number', sortable: false, visible: true, order: 5,
    relationship: { targetEntity: 'contacts', foreignKey: 'clientId' },
  },
  {
    fieldKey: 'jobOpeningsCount', label: 'Job Openings', fieldType: 'number', sortable: false, visible: true, order: 6,
    relationship: { targetEntity: 'job_openings', foreignKey: 'clientId' },
  },
];

export const clientLayoutSections: LayoutSection[] = [
  {
    id: 'sec-client-1',
    name: 'Client Information',
    columns: 2,
    sortOrder: 1,
    isCollapsible: false,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'clientName', label: 'Client Name', fieldType: 'text', required: true, isQuickCreate: true, maxLength: 255, columnIndex: 0 },
      { fieldKey: 'website', label: 'Website', fieldType: 'url', required: false, isQuickCreate: true, columnIndex: 1 },
      {
        fieldKey: 'industry', label: 'Industry', fieldType: 'picklist', required: false, isQuickCreate: false, columnIndex: 0,
        picklistOptions: INDUSTRIES.map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s })),
      },
      { fieldKey: 'contactNumber', label: 'Contact Number', fieldType: 'phone', required: false, isQuickCreate: false, columnIndex: 1 },
      { fieldKey: 'about', label: 'About', fieldType: 'textarea', required: false, isQuickCreate: false, columnIndex: 0 },
    ],
  },
];

export const clientSearchColumns = ['clientName'];
