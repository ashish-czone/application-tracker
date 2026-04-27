import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Badge, Button } from '@packages/ui';
import { useTagGroupBySlug, useTagsByGroup } from '@domains/recruit-ui/hooks/useTagsApi';
import { useAttachSkill, useDetachSkill } from '@domains/recruit-ui/hooks/useCandidatesApi';

interface SkillsManagerProps {
  entity: Record<string, unknown>;
}

export function SkillsManager({ entity: candidate }: SkillsManagerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const { data: skillGroup } = useTagGroupBySlug('candidate-skills');
  const { data: allTags } = useTagsByGroup(skillGroup?.id);

  const id = candidate.id as string;
  const skills = (candidate.skills ?? []) as { id: string; name: string; slug: string }[];

  const attachMutation = useAttachSkill(id);
  const detachMutation = useDetachSkill(id);

  const currentSkillIds = new Set(skills.map((s) => s.id));
  const availableTags = allTags?.filter((t) => !currentSkillIds.has(t.id)) ?? [];

  return (
    <div className="border rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <span className="text-sm font-medium text-foreground">Skills</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShowPicker(!showPicker)}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      <div className="px-4 py-3">
        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <Badge key={skill.id} variant="secondary" className="gap-1 pr-1">
                {skill.name}
                <button
                  type="button"
                  onClick={() => detachMutation.mutate(skill.id)}
                  disabled={detachMutation.isPending}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-foreground/10 transition-colors"
                  aria-label={`Remove ${skill.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No skills added yet</p>
        )}

        {showPicker && (
          <div className="mt-3 border rounded-md p-2 max-h-40 overflow-y-auto">
            {availableTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      attachMutation.mutate(tag.id);
                      setShowPicker(false);
                    }}
                    disabled={attachMutation.isPending}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-muted hover:bg-accent text-foreground transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {tag.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">All skills already added</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
