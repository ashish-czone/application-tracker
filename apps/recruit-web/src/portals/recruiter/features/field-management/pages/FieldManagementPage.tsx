import { useState } from 'react';
import {
  LayoutCanvas,
  FieldPalette,
  CreateFieldDialog,
  EditFieldDialog,
  CreateSectionDialog,
  EditSectionDialog,
} from '@packages/eav-attributes-ui';
import type { FieldDefinition, FieldType, LayoutSection } from '@packages/eav-attributes-ui';
import { ConfirmDialog } from '@packages/ui';
import {
  useLayout,
  useCreateField,
  useUpdateField,
  useDeleteField,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useAddFieldToSection,
  useRemoveFieldFromSection,
  useReorderSections,
  useReorderFields,
  useLookupEntities,
} from '../hooks';

interface FieldManagementPageProps {
  entityType: string;
}

export default function FieldManagementPage({ entityType }: FieldManagementPageProps) {
  const [createFieldOpen, setCreateFieldOpen] = useState(false);
  const [createFieldType, setCreateFieldType] = useState<FieldType | undefined>();
  const [createFieldForSection, setCreateFieldForSection] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [editingSection, setEditingSection] = useState<LayoutSection | null>(null);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);

  const { data: layout, isLoading } = useLayout(entityType);
  const { data: lookupEntities } = useLookupEntities();

  const createFieldMutation = useCreateField(entityType);
  const updateFieldMutation = useUpdateField(entityType, { onSuccess: () => setEditingField(null) });
  const deleteFieldMutation = useDeleteField(entityType, { onSuccess: () => setEditingField(null) });
  const createSectionMutation = useCreateSection(entityType, { onSuccess: () => setCreateSectionOpen(false) });
  const updateSectionMutation = useUpdateSection(entityType, { onSuccess: () => setEditingSection(null) });
  const deleteSectionMutation = useDeleteSection(entityType, { onSuccess: () => setDeletingSectionId(null) });
  const addFieldMutation = useAddFieldToSection(entityType);
  const removeFieldMutation = useRemoveFieldFromSection(entityType);
  const reorderSectionsMutation = useReorderSections(entityType);
  const reorderFieldsMutation = useReorderFields(entityType);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!layout) {
    return <p className="text-sm text-muted-foreground">No layout configuration found for this entity.</p>;
  }

  const unassignedSection = layout.sections.find((s) => s.id === '__unassigned__');
  const unassignedFields = unassignedSection?.fields ?? [];
  const deletingSection = deletingSectionId
    ? layout.sections.find((s) => s.id === deletingSectionId)
    : null;

  return (
    <div className="flex gap-6">
      <FieldPalette
        unassignedFields={unassignedFields}
        onCreateField={(type) => {
          setCreateFieldType(type);
          setCreateFieldOpen(true);
        }}
        onCustomFieldClick={() => {
          setCreateFieldType(undefined);
          setCreateFieldOpen(true);
        }}
      />

      <LayoutCanvas
        sections={layout.sections}
        onAddFieldToSection={(sectionId, fieldId) =>
          addFieldMutation.mutateAsync({ sectionId, fieldId })
        }
        onRemoveFieldFromSection={(sectionId, fieldId) =>
          removeFieldMutation.mutateAsync({ sectionId, fieldId })
        }
        onReorderFields={(sectionId, orderedFields) =>
          reorderFieldsMutation.mutate({ sectionId, orderedFields })
        }
        onReorderSections={(orderedSectionIds) =>
          reorderSectionsMutation.mutate(orderedSectionIds)
        }
        onMoveFieldToSection={async (sourceSectionId, targetSectionId, fieldId) => {
          await removeFieldMutation.mutateAsync({ sectionId: sourceSectionId, fieldId });
          await addFieldMutation.mutateAsync({ sectionId: targetSectionId, fieldId });
        }}
        onEditSection={(section) => setEditingSection(section)}
        onDeleteSection={(sectionId) => setDeletingSectionId(sectionId)}
        onEditField={(field) => setEditingField(field)}
        onAddSectionClick={() => setCreateSectionOpen(true)}
        onAddFieldClick={(sectionId) => {
          setCreateFieldType(undefined);
          setCreateFieldForSection(sectionId);
          setCreateFieldOpen(true);
        }}
      />

      <CreateFieldDialog
        open={createFieldOpen}
        onOpenChange={(open) => {
          setCreateFieldOpen(open);
          if (!open) setCreateFieldForSection(null);
        }}
        onSubmit={async (data) => {
          const field = await createFieldMutation.mutateAsync(data);
          if (createFieldForSection && field?.id) {
            await addFieldMutation.mutateAsync({ sectionId: createFieldForSection, fieldId: field.id });
          }
          setCreateFieldOpen(false);
          setCreateFieldForSection(null);
        }}
        isPending={createFieldMutation.isPending}
        preselectedType={createFieldType}
        lookupEntities={lookupEntities}
      />

      <EditFieldDialog
        field={editingField}
        open={!!editingField}
        onOpenChange={(open) => !open && setEditingField(null)}
        onSubmit={(fieldId, data) => updateFieldMutation.mutate({ id: fieldId, data })}
        onDelete={(fieldId) => deleteFieldMutation.mutate(fieldId)}
        isPending={updateFieldMutation.isPending}
      />

      <CreateSectionDialog
        open={createSectionOpen}
        onOpenChange={setCreateSectionOpen}
        onSubmit={(data) => createSectionMutation.mutate(data)}
        isPending={createSectionMutation.isPending}
      />

      <EditSectionDialog
        section={editingSection}
        open={!!editingSection}
        onOpenChange={(open) => !open && setEditingSection(null)}
        onSubmit={(sectionId, data) => updateSectionMutation.mutate({ id: sectionId, data })}
        isPending={updateSectionMutation.isPending}
      />

      <ConfirmDialog
        open={!!deletingSectionId}
        onOpenChange={(open) => !open && setDeletingSectionId(null)}
        title="Delete Section"
        description={
          deletingSection && deletingSection.fields.length > 0
            ? `"${deletingSection.name}" contains ${deletingSection.fields.length} field(s). They will be moved to unassigned.`
            : `Are you sure you want to delete "${deletingSection?.name ?? 'this section'}"?`
        }
        confirmLabel="Delete Section"
        isPending={deleteSectionMutation.isPending}
        onConfirm={() => {
          if (deletingSectionId) deleteSectionMutation.mutate(deletingSectionId);
        }}
      />
    </div>
  );
}
