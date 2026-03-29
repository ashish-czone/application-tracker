import { api } from '../../../../lib/api';
import type { FullLayout, CreateFieldInput, UpdateFieldInput, CreateSectionInput, FieldDefinition } from './types';

// Layout
export function getLayout(entityType: string): Promise<FullLayout> {
  return api.get<FullLayout>(`/layouts/${entityType}`);
}

// Fields
export async function createField(entityType: string, data: CreateFieldInput): Promise<FieldDefinition> {
  const { picklistOptions, ...fieldData } = data;
  const field = await api.post<FieldDefinition>('/fields', { entityType, ...fieldData });

  // Picklist options are set via a separate endpoint after field creation
  if (picklistOptions && picklistOptions.length > 0) {
    await setPicklistOptions(field.id, picklistOptions);
  }

  return field;
}

export function updateField(fieldId: string, data: UpdateFieldInput): Promise<FieldDefinition> {
  return api.patch<FieldDefinition>(`/fields/${fieldId}`, data);
}

export function deleteField(fieldId: string): Promise<void> {
  return api.delete<void>(`/fields/${fieldId}`);
}

export function setPicklistOptions(fieldId: string, options: { label: string; value: string; isDefault?: boolean }[]): Promise<void> {
  return api.post<void>(`/fields/${fieldId}/options`, { options });
}

// Sections
export function createSection(entityType: string, data: CreateSectionInput): Promise<void> {
  return api.post<void>(`/layouts/${entityType}/sections`, data);
}

export function updateSection(entityType: string, sectionId: string, data: Partial<CreateSectionInput>): Promise<void> {
  return api.patch<void>(`/layouts/${entityType}/sections/${sectionId}`, data);
}

export function deleteSection(entityType: string, sectionId: string): Promise<void> {
  return api.delete<void>(`/layouts/${entityType}/sections/${sectionId}`);
}

export function reorderSections(entityType: string, orderedIds: string[]): Promise<void> {
  return api.put<void>(`/layouts/${entityType}/sections/reorder`, { orderedIds });
}

// Field placement
export function addFieldToSection(entityType: string, sectionId: string, fieldId: string, columnIndex?: number): Promise<void> {
  return api.post<void>(`/layouts/${entityType}/sections/${sectionId}/fields`, { fieldId, columnIndex });
}

export function removeFieldFromSection(entityType: string, sectionId: string, fieldId: string): Promise<void> {
  return api.delete<void>(`/layouts/${entityType}/sections/${sectionId}/fields/${fieldId}`);
}

export function reorderFields(
  entityType: string,
  sectionId: string,
  orderedFields: { fieldId: string; columnIndex: number }[],
): Promise<void> {
  return api.put<void>(`/layouts/${entityType}/sections/${sectionId}/fields/reorder`, { orderedFields });
}

// Lookups
export function getLookupEntities(): Promise<string[]> {
  return api.get<string[]>('/lookups');
}

export function getLookupOptions(entity: string): Promise<{ label: string; value: string }[]> {
  return api.get<{ label: string; value: string }[]>(`/lookups/${entity}?limit=200`);
}

export function getPicklistOptions(fieldId: string): Promise<{ label: string; value: string }[]> {
  return api.get<{ label: string; value: string }[]>(`/fields/${fieldId}/options`);
}

export async function getTagGroupSlugs(): Promise<string[]> {
  const groups = await api.get<{ slug: string }[]>('/tag-groups');
  return groups.map((g) => g.slug);
}

export async function getCategoryGroupSlugs(): Promise<string[]> {
  const groups = await api.get<{ slug: string }[]>('/category-groups');
  return groups.map((g) => g.slug);
}

export async function getCategoryOptions(groupSlug: string): Promise<{ label: string; value: string }[]> {
  const groups = await api.get<{ id: string; slug: string }[]>('/category-groups');
  const group = groups.find((g) => g.slug === groupSlug);
  if (!group) return [];
  const tree = await api.get<{ id: string; name: string }[]>(`/category-groups/${group.id}/tree`);
  return tree.map((c) => ({ label: c.name, value: c.id }));
}
