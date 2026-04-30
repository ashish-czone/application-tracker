import type { LawNode, LawJurisdiction } from '../types';
import type { LawApiRecord, LawTreeApiNode } from '../../../../../hooks/useLawsApi';

const JURISDICTIONS: LawJurisdiction[] = ['central', 'state', 'municipal', 'international'];

function normalizeJurisdiction(value: string | null | undefined): LawJurisdiction {
  if (value && (JURISDICTIONS as string[]).includes(value)) {
    return value as LawJurisdiction;
  }
  return 'central';
}

export function mapLawRecord(record: LawApiRecord): LawNode {
  return {
    id: record.id,
    citation: record.code ?? record.name ?? '—',
    title: record.name ?? '—',
    jurisdiction: normalizeJurisdiction(record.jurisdiction),
    effectiveFrom: record.effectiveFrom ?? undefined,
  };
}

/**
 * Convert a server-built tree node into the UI's `LawNode` shape. Field
 * differences are presentation-only (`code`/`name` → `citation`/`title`);
 * children are mapped recursively. Used by `useLawsTree`-driven views.
 */
export function mapTreeApiNode(node: LawTreeApiNode): LawNode {
  return {
    id: node.id,
    citation: node.code,
    title: node.name,
    jurisdiction: node.jurisdiction,
    effectiveFrom: node.effectiveFrom ?? undefined,
    children: node.children?.map(mapTreeApiNode),
  };
}

export function mapTreeApiNodes(nodes: LawTreeApiNode[]): LawNode[] {
  return nodes.map(mapTreeApiNode);
}

/**
 * Builds a hierarchical tree from a flat list of law records using parentId.
 * Records whose parent is missing from the input are surfaced at the root so
 * nothing is lost.
 *
 * Kept for callers that still pass through `useLawsList` (a fading code
 * path); new screens should consume `useLawsTree` and `mapTreeApiNodes`.
 */
export function buildLawTree(records: LawApiRecord[]): LawNode[] {
  const byId = new Map<string, LawNode>();
  const childrenByParent = new Map<string, LawNode[]>();
  const roots: LawNode[] = [];

  for (const record of records) {
    byId.set(record.id, mapLawRecord(record));
  }

  for (const record of records) {
    const node = byId.get(record.id);
    if (!node) continue;
    const parentId = record.parentId;
    if (parentId && byId.has(parentId)) {
      const siblings = childrenByParent.get(parentId) ?? [];
      siblings.push(node);
      childrenByParent.set(parentId, siblings);
    } else {
      roots.push(node);
    }
  }

  for (const [parentId, kids] of childrenByParent) {
    const parent = byId.get(parentId);
    if (parent) parent.children = kids;
  }

  return roots;
}

export function flattenLawTree(nodes: LawNode[]): LawNode[] {
  const out: LawNode[] = [];
  const walk = (list: LawNode[]) => {
    for (const node of list) {
      out.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}
