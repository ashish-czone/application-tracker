import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MockEntity {
  entityType: string;
  singularName: string;
  pluralName: string;
  slug: string;
  icon: string;
  nameField: string | string[];
  createMode?: 'modal' | 'page' | 'wizard';
  boardFields?: string[];
  features?: Partial<{
    softDelete: boolean;
    restore: boolean;
    hasTaxonomy: boolean;
    hasWorkflow: boolean;
    hasMedia: boolean;
    hasNotes: boolean;
    hasAttachments: boolean;
    hasEvaluations: boolean;
  }>;
  relationships?: {
    name: string;
    type: 'hasMany' | 'belongsTo';
    targetEntity: string;
    foreignKey?: string;
    label: string;
  }[];
}

export interface ListColumn {
  fieldKey: string;
  label: string;
  fieldType: string;
  sortable: boolean;
  visible: boolean;
  order: number;
  operators?: string[];
  picklistOptions?: { label: string; value: string }[];
  lookupEntity?: string;
  tagGroupSlug?: string;
  categoryGroupSlug?: string;
  relationship?: { targetEntity: string; foreignKey: string };
  cellRenderer?: string;
}

export interface LayoutSection {
  id: string;
  name: string;
  columns: number;
  sortOrder: number;
  isCollapsible: boolean;
  isTabular: boolean;
  tabularMaxRows: number | null;
  fields: LayoutField[];
}

export interface LayoutField {
  fieldKey: string;
  label: string;
  fieldType: string;
  required: boolean;
  isQuickCreate: boolean;
  maxLength?: number;
  picklistOptions?: { label: string; value: string }[];
  lookupEntity?: string;
  tagGroupSlug?: string;
  categoryGroupSlug?: string;
  columnIndex: number;
  section?: string;
  sortOrder?: number;
}

export interface EntityAction {
  key: string;
  label: string;
  icon?: string;
  variant?: 'destructive';
}

interface MockEntityConfig {
  entity: MockEntity;
  listColumns: ListColumn[];
  layoutSections: LayoutSection[];
  quickCreateFields?: LayoutField[];
  records: Record<string, unknown>[];
  rowActions?: EntityAction[];
  bulkActions?: EntityAction[];
  detailActions?: EntityAction[];
  searchColumns?: string[];
}

// ---------------------------------------------------------------------------
// Entity Registry (all recruit entities)
// ---------------------------------------------------------------------------

function buildRegistryEntry(entity: MockEntity) {
  return {
    entityType: entity.entityType,
    singularName: entity.singularName,
    pluralName: entity.pluralName,
    slug: entity.slug,
    ui: {
      icon: entity.icon,
      nameField: entity.nameField,
      navGroup: 'recruit',
      navOrder: 1,
      createMode: entity.createMode ?? 'modal',
      boardFields: entity.boardFields ?? [],
    },
    features: {
      softDelete: true,
      restore: true,
      hasTaxonomy: false,
      hasWorkflow: false,
      hasMedia: false,
      hasNotes: false,
      hasAttachments: false,
      hasEvaluations: false,
      workflowDiscriminator: null,
      ...entity.features,
    },
    relationships: entity.relationships ?? [],
  };
}

// ---------------------------------------------------------------------------
// Mock setup for a single entity
// ---------------------------------------------------------------------------

export async function mockEntityApi(page: Page, config: MockEntityConfig) {
  const { entity, listColumns, layoutSections, quickCreateFields, records, searchColumns } = config;
  const rowActions = config.rowActions ?? [
    { key: 'edit', label: 'Edit' },
    { key: 'clone', label: 'Clone' },
    { key: 'delete', label: 'Delete', variant: 'destructive' },
  ];
  const bulkActions = config.bulkActions ?? [
    { key: 'massDelete', label: 'Delete', icon: 'Trash2', variant: 'destructive' },
    { key: 'export', label: 'Export', icon: 'Download' },
  ];
  const detailActions = config.detailActions ?? [];

  // --- List layout ---
  await page.route(`**/api/v1/${entity.slug}/layout/list`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        columns: listColumns,
        actions: { row: rowActions, bulk: bulkActions, detail: detailActions },
        filters: listColumns.filter((c) => c.operators?.length).map((c) => c.fieldKey),
        defaultSort: 'createdAt',
        defaultOrder: 'desc',
      }),
    });
  });

  // --- Detail / form layout ---
  await page.route(`**/api/v1/layouts/${entity.entityType}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entityType: entity.entityType,
        layoutName: 'default',
        sections: layoutSections,
        quickCreateFields: quickCreateFields ?? layoutSections.flatMap((s) =>
          s.fields.filter((f) => f.isQuickCreate),
        ),
      }),
    });
  });

  // --- List data ---
  await page.route(`**/api/v1/${entity.slug}?*`, (route) => {
    const url = new URL(route.request().url());
    const pageNum = Number(url.searchParams.get('page')) || 1;
    const limit = Number(url.searchParams.get('limit')) || 25;
    const search = url.searchParams.get('search')?.toLowerCase() || '';
    const sort = url.searchParams.get('sort') || 'createdAt';
    const order = url.searchParams.get('order') || 'desc';

    let filtered = [...records];

    if (search && searchColumns?.length) {
      filtered = filtered.filter((r) =>
        searchColumns.some((col) =>
          String(r[col] ?? '').toLowerCase().includes(search),
        ),
      );
    }

    filtered.sort((a, b) => {
      const aVal = String(a[sort] ?? '');
      const bVal = String(b[sort] ?? '');
      return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (pageNum - 1) * limit;
    const data = filtered.slice(start, start + limit);

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data, meta: { total, page: pageNum, limit, totalPages } }),
    });
  });

  // --- Exact slug route (no query params — catches GET /{slug} without ?) ---
  await page.route(new RegExp(`/api/v1/${entity.slug}$`), (route) => {
    if (route.request().method() === 'POST') {
      // Create
      const body = route.request().postDataJSON() ?? {};
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'new-entity-001', ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
      });
    } else {
      // List without query params
      const data = records.slice(0, 25);
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data, meta: { total: records.length, page: 1, limit: 25, totalPages: Math.ceil(records.length / 25) } }),
      });
    }
  });

  // --- Detail / Update / Delete / Clone / Restore ---
  // Use negative lookahead to NOT match /layout/ paths (handled by the layout route above)
  await page.route(new RegExp(`/api/v1/${entity.slug}/(?!layout)[^/]+`), (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Clone
    if (url.endsWith('/clone') && method === 'POST') {
      const record = records[0] ?? {};
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...record, id: 'cloned-001' }),
      });
    }

    // Restore
    if (url.endsWith('/restore') && method === 'POST') {
      const record = records[0] ?? {};
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...record, deletedAt: null }),
      });
    }

    // Transition (workflow)
    if (url.endsWith('/transition') && method === 'POST') {
      const body = route.request().postDataJSON() ?? {};
      const record = records[0] ?? {};
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...record, [body.fieldKey]: body.to }),
      });
    }

    // Detail GET
    if (method === 'GET') {
      const match = url.match(new RegExp(`/api/v1/${entity.slug}/([^/?]+)`));
      const id = match?.[1];
      const record = records.find((r) => r.id === id) ?? records[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(record ?? { id }),
      });
    }

    // Update PATCH
    if (method === 'PATCH') {
      const body = route.request().postDataJSON() ?? {};
      const record = records[0] ?? {};
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...record, ...body, updatedAt: new Date().toISOString() }),
      });
    }

    // Delete
    if (method === 'DELETE') {
      return route.fulfill({ status: 204, body: '' });
    }

    route.continue();
  });
}

// ---------------------------------------------------------------------------
// Global mocks (auth, registry, lookups, workflows, etc.)
// ---------------------------------------------------------------------------

export async function mockGlobalApis(page: Page, entityConfigs: MockEntity[]) {
  // --- Entity registry ---
  await page.route('**/api/v1/entity-engine/registry', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(entityConfigs.map(buildRegistryEntry)),
    });
  });

  // --- Lookups (return empty by default) ---
  await page.route('**/api/v1/lookups/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // --- User search ---
  await page.route('**/api/v1/users*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'user-001', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
          { id: 'user-002', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
        ],
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      }),
    });
  });

  // --- Tags ---
  await page.route('**/api/v1/tags/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // --- Categories ---
  await page.route('**/api/v1/category-groups*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
  await page.route('**/api/v1/categories/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // --- Workflows ---
  await page.route('**/api/v1/workflows', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
  await page.route('**/api/v1/workflows/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // --- Permissions ---
  await page.route('**/api/v1/permissions/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ permissions: [] }),
    });
  });

  // --- Auth refresh (in case token refresh is attempted) ---
  // Must return a valid JWT structure that atob() can decode
  await page.route('**/api/v1/auth/client/refresh', async (route) => {
    // Build a valid JWT in the same format the browser expects
    const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
    const payload = JSON.stringify({
      userId: 'test-user-001',
      userType: 'admin',
      permissions: { '*': '*' },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    });
    // Use standard base64 (matching btoa in browser)
    const b64 = (s: string) => Buffer.from(s).toString('base64');
    const token = `${b64(header)}.${b64(payload)}.fake-signature`;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: token, refreshToken: 'fake-refresh-v2' }),
    });
  });

  // --- OAuth providers ---
  await page.route('**/api/v1/auth/oauth/providers', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // --- Notes ---
  await page.route('**/api/v1/notes**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 25, totalPages: 0 } }),
    });
  });

  // --- Attachments ---
  await page.route('**/api/v1/attachments**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 25, totalPages: 0 } }),
    });
  });

  // --- Audit trail ---
  await page.route('**/api/v1/audit-logs**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 25, totalPages: 0 } }),
    });
  });

  // --- Evaluations ---
  await page.route('**/api/v1/evaluations**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 25, totalPages: 0 } }),
    });
  });

  // --- Settings ---
  await page.route('**/api/v1/settings**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  // --- Notification channels / preferences ---
  await page.route('**/api/v1/notification**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 25, totalPages: 0 } }),
    });
  });

  // --- Navigation / sidebar ---
  await page.route('**/api/v1/navigation*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // --- Queued tasks ---
  await page.route('**/api/v1/queued-tasks*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 25, totalPages: 0 } }),
    });
  });
}
