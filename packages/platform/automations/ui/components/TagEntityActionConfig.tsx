import { useMemo } from 'react';
import { Tag } from 'lucide-react';
import { FormSelect, Label } from '@packages/ui';
import { EntityConditionBuilder } from '@packages/entity-engine-ui';
import type { Condition } from '@packages/conditions-ui';
import { useTagGroupsList, useTagsByGroup } from '@packages/taxonomy-ui';

interface TagEntityActionConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  /** Pre-fetched entity options for the entity type picker */
  entityOptions: { value: string; label: string }[];
}

const MODE_OPTIONS = [
  { value: 'add', label: 'Add tags' },
  { value: 'remove', label: 'Remove tags' },
];

/**
 * Action config component for the "tag_entity" action type.
 * Renders:
 * 1. Entity type picker
 * 2. Conditions (EntityConditionBuilder, no payload operators)
 * 3. Mode toggle (add/remove)
 * 4. Tag group picker → tag multi-select with color chips
 */
export function TagEntityActionConfig({
  config,
  onChange,
  entityOptions,
}: TagEntityActionConfigProps) {
  const entityType = (config.entityType as string) ?? '';
  const conditions = (config.conditions as Condition[]) ?? [];
  const mode = (config.mode as string) ?? 'add';
  const tagIds = (config.tagIds as string[]) ?? [];

  // Tag groups
  const { data: tagGroupsData } = useTagGroupsList({ limit: 100 });
  const tagGroups = tagGroupsData?.data ?? [];

  // Infer selected group from the first selected tag
  const selectedGroupId = useMemo(() => {
    if (config.tagGroupId) return config.tagGroupId as string;
    return '';
  }, [config.tagGroupId]);

  // Tags for selected group
  const { data: tagsInGroup } = useTagsByGroup(selectedGroupId || null);

  const tagGroupOptions = useMemo(() =>
    tagGroups.map((g) => ({ value: g.id, label: g.name })),
  [tagGroups]);

  const tagOptions = useMemo(() =>
    (tagsInGroup ?? []).map((t) => ({ value: t.id, label: t.name, color: t.color })),
  [tagsInGroup]);

  const handleEntityTypeChange = (value: string) => {
    onChange({ ...config, entityType: value || undefined, conditions: [] });
  };

  const handleConditionsChange = (newConditions: Condition[]) => {
    onChange({ ...config, conditions: newConditions });
  };

  const handleModeChange = (value: string) => {
    onChange({ ...config, mode: value });
  };

  const handleTagGroupChange = (groupId: string) => {
    onChange({ ...config, tagGroupId: groupId || undefined, tagIds: [] });
  };

  const toggleTag = (tagId: string) => {
    const current = new Set(tagIds);
    if (current.has(tagId)) {
      current.delete(tagId);
    } else {
      current.add(tagId);
    }
    onChange({ ...config, tagIds: Array.from(current) });
  };

  return (
    <div className="space-y-3">
      <FormSelect
        value={entityType}
        onChange={handleEntityTypeChange}
        options={entityOptions}
        label="Entity Type"
        placeholder="Select entity type..."
      />

      {entityType && (
        <>
          <div className="space-y-2">
            <Label>Conditions (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Filter which entities of this type to tag. Leave empty to tag all.
            </p>
            <EntityConditionBuilder
              conditions={conditions}
              onChange={handleConditionsChange}
              entityType={entityType}
              includePayloadOperators={false}
            />
          </div>

          <FormSelect
            value={mode}
            onChange={handleModeChange}
            options={MODE_OPTIONS}
            label="Action"
          />

          <FormSelect
            value={selectedGroupId as string}
            onChange={handleTagGroupChange}
            options={tagGroupOptions}
            label="Tag Group"
            placeholder="Select tag group..."
          />

          {selectedGroupId && tagOptions.length > 0 && (
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((tag) => {
                  const isSelected = tagIds.includes(tag.value);
                  return (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => toggleTag(tag.value)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                          : 'border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      {tag.color ? (
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                      ) : (
                        <Tag className="h-3 w-3" />
                      )}
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedGroupId && tagOptions.length === 0 && tagsInGroup !== undefined && (
            <p className="text-sm text-muted-foreground">No tags in this group.</p>
          )}
        </>
      )}
    </div>
  );
}
