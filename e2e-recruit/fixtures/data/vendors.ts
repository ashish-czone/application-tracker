import type { MockEntity, ListColumn, LayoutSection } from '../mock-api';

export function generateVendors(count = 30) {
  const names = [
    'StaffPro Agency', 'TalentBridge', 'RecruitFirst', 'HireWell', 'PeopleConnect',
    'TopTalent Inc', 'CareerPath', 'SkillMatch', 'WorkForce Plus', 'TalentStream',
    'ProHire', 'EliteStaff', 'PrimeTalent', 'SwiftHire', 'NextGen Recruiting',
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `vendor-${String(i + 1).padStart(3, '0')}`,
    vendorName: names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : ''),
    email: `contact@${names[i % names.length].toLowerCase().replace(/\s+/g, '')}.com`,
    phone: `+1555${String(4000 + i).padStart(7, '0')}`,
    website: `https://${names[i % names.length].toLowerCase().replace(/\s+/g, '')}.com`,
    createdAt: new Date(2026, 0, i + 1).toISOString(),
    updatedAt: new Date(2026, 0, i + 1).toISOString(),
    createdBy: 'user-001',
    createdBy__label: 'John Doe',
  }));
}

export const vendorEntity: MockEntity = {
  entityType: 'vendors',
  singularName: 'Vendor',
  pluralName: 'Vendors',
  slug: 'vendors',
  icon: 'store',
  nameField: 'vendorName',
};

export const vendorListColumns: ListColumn[] = [
  { fieldKey: 'vendorName', label: 'Vendor Name', fieldType: 'text', sortable: true, visible: true, order: 1 },
  { fieldKey: 'email', label: 'Email', fieldType: 'email', sortable: true, visible: true, order: 2 },
  { fieldKey: 'phone', label: 'Phone', fieldType: 'phone', sortable: false, visible: true, order: 3 },
  { fieldKey: 'website', label: 'Website', fieldType: 'url', sortable: false, visible: true, order: 4 },
];

export const vendorLayoutSections: LayoutSection[] = [
  {
    id: 'sec-vendor-1',
    name: 'Vendor Information',
    columns: 2,
    sortOrder: 1,
    isCollapsible: false,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'vendorName', label: 'Vendor Name', fieldType: 'text', required: true, isQuickCreate: true, maxLength: 120, columnIndex: 0 },
      { fieldKey: 'email', label: 'Email', fieldType: 'email', required: false, isQuickCreate: true, columnIndex: 1 },
      { fieldKey: 'phone', label: 'Phone', fieldType: 'phone', required: false, isQuickCreate: true, columnIndex: 0 },
      { fieldKey: 'website', label: 'Website', fieldType: 'url', required: false, isQuickCreate: false, columnIndex: 1 },
    ],
  },
];

export const vendorSearchColumns = ['vendorName', 'email'];
