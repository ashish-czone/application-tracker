import { useState } from 'react';
import {
  LayoutCanvas,
  FieldPalette,
  CreateFieldDialog,
  EditFieldDialog,
  CreateSectionDialog,
} from '@packages/eav-attributes-ui';
import type { FieldDefinition, FieldType } from '@packages/eav-attributes-ui';
import {
  useLayout,
  useCreateField,
  useUpdateField,
  useDeleteField,
  useCreateSection,
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
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [editSectionOpen, setEditSectionOpen] = useState(false);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);

  const { data: layout, isLoading } = useLayout(entityType);
  const { data: lookupEntities } = useLookupEntities();

  const createFieldMutation = useCreateField(entityType, { onSuccess: () => setCreateFieldOpen(false) });
  const updateFieldMutation = useUpdateField(entityType, { onSuccess: () => setEditingField(null) });
  const deleteFieldMutation = useDeleteField(entityType, { onSuccess: () => setEditingField(null) });
  const createSectionMutation = useCreateSection(entityType, { onSuccess: () => setCreateSectionOpen(false) });
  const deleteSectionMutation = useDeleteSection(entityType);
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
        onReorderFields={(sectionId, orderedFieldIds) =>
          reorderFieldsMutation.mutate({ sectionId, orderedFieldIds })
        }
        onReorderSections={(orderedSectionIds) =>
          reorderSectionsMutation.mutate(orderedSectionIds)
        }
        onMoveFieldToSection={async (sourceSectionId, targetSectionId, fieldId) => {
          await removeFieldMutation.mutateAsync({ sectionId: sourceSectionId, fieldId });
          await addFieldMutation.mutateAsync({ sectionId: targetSectionId, fieldId });
        }}
        onEditSection={() => setEditSectionOpen(true)}
        onDeleteSection={(sectionId) => deleteSectionMutation.mutate(sectionId)}
        onEditField={(field) => setEditingField(field)}
        onAddSectionClick={() => setCreateSectionOpen(true)}
        onAddFieldClick={(sectionId) => {
          setCreateFieldType(undefined);
          setCreateFieldOpen(true);
        }}
      />

      <CreateFieldDialog
        open={createFieldOpen}
        onOpenChange={setCreateFieldOpen}
        onSubmit={(data) => createFieldMutation.mutate(data)}
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
    </div>
  );
}
