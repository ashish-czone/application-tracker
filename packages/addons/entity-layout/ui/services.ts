import type { ApiFn } from '@packages/platform-ui';
import type {
  FieldDefinition,
  FieldTypeRegistryEntry,
  FullLayout,
  CreateFieldInput,
  UpdateFieldInput,
  CreateSectionInput,
} from '@packages/eav-attributes-ui';

export function createFieldManagementApi(api: ApiFn) {
  function setPicklistOptions(
    fieldId: string,
    options: { label: string; value: string; isDefault?: boolean }[],
  ): Promise<void> {
    return api.post<void>(`/fields/${fieldId}/options`, { options });
  }

  return {
    getLayout(entityType: string): Promise<FullLayout> {
      return api.get<FullLayout>(`/layouts/${entityType}`);
    },

    async createField(entityType: string, data: CreateFieldInput): Promise<FieldDefinition> {
      const { picklistOptions, ...fieldData } = data;
      const field = await api.post<FieldDefinition>('/fields', { entityType, ...fieldData });
      if (picklistOptions && picklistOptions.length > 0) {
        await setPicklistOptions(field.id, picklistOptions);
      }
      return field;
    },

    updateField(fieldId: string, data: UpdateFieldInput): Promise<FieldDefinition> {
      return api.patch<FieldDefinition>(`/fields/${fieldId}`, data);
    },

    deleteField(fieldId: string): Promise<void> {
      return api.delete<void>(`/fields/${fieldId}`);
    },

    setPicklistOptions,

    createSection(entityType: string, data: CreateSectionInput): Promise<void> {
      return api.post<void>(`/layouts/${entityType}/sections`, data);
    },

    updateSection(
      entityType: string,
      sectionId: string,
      data: Partial<CreateSectionInput>,
    ): Promise<void> {
      return api.patch<void>(`/layouts/${entityType}/sections/${sectionId}`, data);
    },

    deleteSection(entityType: string, sectionId: string): Promise<void> {
      return api.delete<void>(`/layouts/${entityType}/sections/${sectionId}`);
    },

    reorderSections(entityType: string, orderedIds: string[]): Promise<void> {
      return api.put<void>(`/layouts/${entityType}/sections/reorder`, { orderedIds });
    },

    addFieldToSection(
      entityType: string,
      sectionId: string,
      fieldId: string,
      columnIndex?: number,
    ): Promise<void> {
      return api.post<void>(`/layouts/${entityType}/sections/${sectionId}/fields`, {
        fieldId,
        columnIndex,
      });
    },

    removeFieldFromSection(
      entityType: string,
      sectionId: string,
      fieldId: string,
    ): Promise<void> {
      return api.delete<void>(`/layouts/${entityType}/sections/${sectionId}/fields/${fieldId}`);
    },

    reorderFields(
      entityType: string,
      sectionId: string,
      orderedFields: { fieldId: string; columnIndex: number }[],
    ): Promise<void> {
      return api.put<void>(`/layouts/${entityType}/sections/${sectionId}/fields/reorder`, {
        orderedFields,
      });
    },

    getFieldTypes(): Promise<FieldTypeRegistryEntry[]> {
      return api.get('/fields/types');
    },

    getLookupEntities(): Promise<string[]> {
      return api.get<string[]>('/lookups');
    },

    getLookupOptions(entity: string): Promise<{ label: string; value: string }[]> {
      return api.get<{ label: string; value: string }[]>(`/lookups/${entity}?limit=200`);
    },

    getPicklistOptions(fieldId: string): Promise<{ label: string; value: string }[]> {
      return api.get<{ label: string; value: string }[]>(`/fields/${fieldId}/options`);
    },

    async getTagGroupSlugs(): Promise<string[]> {
      const res = await api.get<{ data: { slug: string }[] }>('/tag-groups?limit=100');
      return res.data.map((g) => g.slug);
    },

    async getCategoryGroupSlugs(): Promise<string[]> {
      const groups = await api.get<{ slug: string }[]>('/category-groups');
      return groups.map((g) => g.slug);
    },

    getTagOptions(groupSlug: string): Promise<{ label: string; value: string }[]> {
      return api.get<{ label: string; value: string }[]>(`/tags/group/${groupSlug}`);
    },

    async getCategoryOptions(groupSlug: string): Promise<{ label: string; value: string }[]> {
      const groups = await api.get<{ id: string; slug: string }[]>('/category-groups');
      const group = groups.find((g) => g.slug === groupSlug);
      if (!group) return [];
      const tree = await api.get<{ id: string; name: string }[]>(
        `/category-groups/${group.id}/tree`,
      );
      return tree.map((c) => ({ label: c.name, value: c.id }));
    },
  };
}

export type FieldManagementApi = ReturnType<typeof createFieldManagementApi>;
