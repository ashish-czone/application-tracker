import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog } from '@packages/ui';
import { DynamicSection } from '@packages/eav-attributes-ui';
import { useEntityEngine, useEntityHooks, useEntityConfig } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';
import { EntityRelatedList } from './EntityRelatedList';

interface EntityDetailPageProps {
  entityType: string;
}

/**
 * Generic detail page for any entity registered with the entity engine.
 * Renders a header with entity name, layout-driven editable sections,
 * and plugin sections (skills, resume, etc.) from the entity UI config.
 */
export function EntityDetailPage({ entityType }: EntityDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const entity = useEntityConfig(entityType);
  const hooks = useEntityHooks(entityType);
  const { getDetailPlugins } = useEntityEngine();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: item, isLoading, isError } = hooks.useDetail(id ?? null);
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(entityType);
  const updateMutation = hooks.useUpdate();
  const deleteMutation = hooks.useDelete({
    onSuccess: () => navigate(`/${entity.slug}`),
  });

  // Get display name from entity
  const getDisplayName = (row: Record<string, unknown>): string => {
    const { nameField } = entity.ui;
    if (Array.isArray(nameField)) {
      return nameField.map((f) => row[f] ?? '').filter(Boolean).join(' ');
    }
    return String(row[nameField] ?? '');
  };

  // Get subtitle
  const getSubtitle = (row: Record<string, unknown>): string | null => {
    if (!entity.ui.subtitleField) return null;
    const val = row[entity.ui.subtitleField];
    return val ? String(val) : null;
  };

  if (isLoading || layoutLoading) {
    return (
      <div className="space-y-4 p-1">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{entity.singularName} not found</p>
        <Link to={`/${entity.slug}`} className="text-sm text-primary hover:underline mt-2 inline-block">
          Back to {entity.pluralName.toLowerCase()}
        </Link>
      </div>
    );
  }

  const displayName = getDisplayName(item);
  const subtitle = getSubtitle(item);
  const plugins = getDetailPlugins(entityType).sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/${entity.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {entity.pluralName}
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{displayName}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Layout-driven sections */}
      <div className="space-y-4">
        {layout?.sections
          .filter((s) => s.fields.length > 0)
          .map((section) => (
            <DynamicSection
              key={section.id}
              section={section}
              values={item}
              onSave={async (values) => {
                await updateMutation.mutateAsync({ id: item.id as string, data: values });
              }}
              isSaving={updateMutation.isPending}
            />
          ))}

        {/* Plugin sections (entity-specific: skills, resume, etc.) */}
        {plugins.map((plugin) => (
          <plugin.component key={plugin.label} entity={item} />
        ))}

        {/* Related lists (from entity relationships config) */}
        {entity.relationships
          .filter((r) => r.type === 'hasMany')
          .map((rel) => (
            <EntityRelatedList
              key={rel.name}
              targetEntityType={rel.targetEntity}
              foreignKey={rel.foreignKey ?? `${entityType}Id`}
              parentId={item.id as string}
              label={rel.label}
            />
          ))}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${entity.singularName.toLowerCase()}`}
        description={`This will delete "${displayName}".`}
        confirmLabel={`Delete ${entity.singularName.toLowerCase()}`}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(item.id as string)}
      />
    </div>
  );
}
