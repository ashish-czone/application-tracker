import { BadRequestException } from '@nestjs/common';
import { defineEntity } from '@packages/entity-engine';
import { menuItems } from './schema/menu-items';

/**
 * Module-level reference to a depth-lookup function, populated by
 * MenusModule at init time. Entity hooks are pure functions without DI
 * access, so we hand them a lookup via this indirection instead of
 * extending the platform's hook signature. An unregistered ref means the
 * host app forgot to import MenusModule — fail-closed, so a missing wire
 * is a loud programming error rather than a silent bypass of the 2-level
 * invariant.
 */
type DepthLookup = (parentId: string) => Promise<number | null>;
let depthLookupRef: DepthLookup | null = null;
export function registerMenuItemDepthLookup(lookup: DepthLookup | null): void {
  depthLookupRef = lookup;
}

const MAX_DEPTH = 1; // depth 0 = top level; depth 1 = dropdown under a top-level item

async function assertParentWithinDepthCap(parentId: unknown): Promise<void> {
  if (parentId === null || parentId === undefined || parentId === '') return;
  if (typeof parentId !== 'string') {
    throw new BadRequestException('parentId must be a string or null');
  }
  if (!depthLookupRef) {
    throw new Error(
      'Menu item depth-cap guard is not wired — MenusModule must be imported before generic /menu-items mutations run.',
    );
  }
  const parentDepth = await depthLookupRef(parentId);
  if (parentDepth === null) {
    throw new BadRequestException(`Parent menu item not found: ${parentId}`);
  }
  if (parentDepth >= MAX_DEPTH) {
    throw new BadRequestException(
      `Menu items cannot be nested more than ${MAX_DEPTH + 1} levels deep`,
    );
  }
}

function validateLinkType(payload: Record<string, unknown>): void {
  const linkType = payload.linkType;
  if (linkType === undefined) return;
  if (linkType !== 'url' && linkType !== 'page') {
    throw new BadRequestException(`linkType must be 'url' or 'page'; got '${String(linkType)}'`);
  }
  if (linkType === 'url' && !payload.url) {
    throw new BadRequestException("linkType='url' requires a non-empty url");
  }
  if (linkType === 'page' && !payload.pageId) {
    throw new BadRequestException("linkType='page' requires a pageId");
  }
}

function validateTarget(payload: Record<string, unknown>): void {
  const target = payload.target;
  if (target === undefined) return;
  if (target !== '_self' && target !== '_blank') {
    throw new BadRequestException(`target must be '_self' or '_blank'; got '${String(target)}'`);
  }
}

/**
 * Validates link type, target, and the 2-level nesting invariant for a
 * menu-item create/update payload. Called from MenuItemsService so hook
 * support in the platform isn't needed; on update, the parent-depth check
 * only runs when `parentId` is present in the patch.
 */
export async function assertMenuItemPayload(
  payload: Record<string, unknown>,
  opts: { isUpdate: boolean },
): Promise<void> {
  validateLinkType(payload);
  validateTarget(payload);
  if (!opts.isUpdate || 'parentId' in payload) {
    await assertParentWithinDepthCap(payload.parentId);
  }
}

export const menuItemConfig = defineEntity({
  table: menuItems,
  slug: 'menu-items',
  singularName: 'Menu Item',
  pluralName: 'Menu Items',
  timestamps: true,
  hierarchy: true,
  orderable: true,

  fields: {
    menuId: {
      type: 'lookup',
      label: 'Menu',
      entity: 'menus',
      lookupLabelField: 'name',
      required: true,
      listVisible: true,
      listOrder: 1,
    },
    label: {
      type: 'text',
      label: 'Label',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 2,
    },
    linkType: {
      type: 'picklist',
      label: 'Link Type',
      required: true,
      options: [
        { value: 'url', label: 'Custom URL' },
        { value: 'page', label: 'Page' },
      ],
      defaultValue: 'url',
      listVisible: true,
      listOrder: 3,
    },
    url: {
      type: 'url',
      label: 'URL',
      maxLength: 2048,
    },
    pageId: {
      type: 'lookup',
      label: 'Page',
      entity: 'pages',
      lookupLabelField: 'title',
    },
    target: {
      type: 'picklist',
      label: 'Target',
      options: [
        { value: '_self', label: 'Same tab' },
        { value: '_blank', label: 'New tab' },
      ],
      defaultValue: '_self',
    },
    createdBy: {
      type: 'user',
      label: 'Created By',
      system: true,
      readonly: true,
    },
    createdAt: {
      type: 'datetime',
      label: 'Created At',
      system: true,
      readonly: true,
      sortable: true,
    },
  },

  ui: {
    icon: 'List',
  },
});
