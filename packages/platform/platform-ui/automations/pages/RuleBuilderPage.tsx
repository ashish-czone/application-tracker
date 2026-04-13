import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import {
  Button, Badge, Card, CardContent, CardHeader, CardTitle,
  Input, Label, FormSelect,
} from '@packages/ui';
import {
  useAutomationRule, useCreateAutomationRule, useUpdateAutomationRule,
  useEvents, useEntities, useEntityFields,
  useActionTypes, useUserStrategies,
} from '../hooks';
import { useTemplates } from '../../notifications/hooks';
import { ConditionBuilder } from '../components/ConditionBuilder';
import { useEntityEngine } from '@packages/entity-engine-ui';
import { TransitionWorkflowActionConfig } from '@packages/platform-ui/workflows/components/TransitionWorkflowActionConfig';
import { TagEntityActionConfig } from '../components/TagEntityActionConfig';
import { EntityCreateActionConfig } from '../components/EntityCreateActionConfig';
import { EntityUpdateActionConfig } from '../components/EntityUpdateActionConfig';
import { EntityDeleteActionConfig } from '../components/EntityDeleteActionConfig';
import type {
  TriggerType, Condition, ActionConfig,
  UserResolution, FieldConfig, ScheduleDateOperator, ScheduleUnit,
} from '../types';
import type { NotificationChannel } from '../../notifications/types';

// --- Constants ---

const TRIGGER_TYPES: { value: TriggerType; label: string; description: string }[] = [
  { value: 'event', label: 'Event Trigger', description: 'Fire when a domain event occurs' },
  { value: 'schedule_once', label: 'One-time Schedule', description: 'Fire once relative to a date field' },
  { value: 'schedule_recurring', label: 'Recurring Schedule', description: 'Fire on a recurring schedule' },
];

const CHANNELS: NotificationChannel[] = ['email', 'in_app', 'whatsapp'];
const CHANNEL_LABELS: Record<NotificationChannel, string> = { email: 'Email', in_app: 'In-App', whatsapp: 'WhatsApp' };

const DAY_OPTIONS = [
  { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
];

// --- Action form state ---

/**
 * Generic entity actions (backend handlers). In the UI dropdown these are
 * expanded into per-entity shortcuts like `create_entity:tasks`. The synthetic
 * dropdown value carries the target entity type so we can hide the per-config
 * entity picker and pre-fill `config.entityType` automatically.
 */
const ENTITY_ACTION_TYPES = ['create_entity', 'update_entity', 'delete_entity'] as const;
type EntityActionType = (typeof ENTITY_ACTION_TYPES)[number];

function isEntityActionType(type: string): type is EntityActionType {
  return (ENTITY_ACTION_TYPES as readonly string[]).includes(type);
}

function actionDropdownValue(type: string, config: Record<string, unknown>): string {
  if (isEntityActionType(type)) {
    const entityType = (config.entityType as string) ?? '';
    return entityType ? `${type}:${entityType}` : type;
  }
  return type;
}

function parseDropdownValue(value: string): { type: string; entityType?: string } {
  const colon = value.indexOf(':');
  if (colon === -1) return { type: value };
  const type = value.slice(0, colon);
  const entityType = value.slice(colon + 1);
  return { type, entityType: entityType || undefined };
}

interface ActionFormState {
  type: string;
  config: Record<string, unknown>;
  users: Record<string, UserResolution>;
}

function emptyAction(): ActionFormState {
  return { type: '', config: {}, users: {} };
}

function actionToFormState(action: ActionConfig): ActionFormState {
  return {
    type: action.type,
    config: action.config ?? {},
    users: action.users ?? {},
  };
}

function formStateToAction(state: ActionFormState): ActionConfig {
  const action: ActionConfig = {
    type: state.type,
    config: state.config,
  };
  if (Object.keys(state.users).length > 0) {
    action.users = state.users;
  }
  return action;
}

// --- Send Notification config helpers ---

interface ChannelConfig {
  channel: NotificationChannel;
  templateId: string;
}

function getSendNotificationChannels(config: Record<string, unknown>): ChannelConfig[] {
  const channels = config.channels;
  if (Array.isArray(channels)) return channels as ChannelConfig[];
  return [];
}

function setSendNotificationChannels(config: Record<string, unknown>, channels: ChannelConfig[]): Record<string, unknown> {
  return { ...config, channels };
}

// --- Component ---

export function RuleBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  // Data fetching
  const { data: existingRule } = useAutomationRule(id ?? '');
  const { data: events } = useEvents();
  const { data: entities } = useEntities();
  const { data: templatesData } = useTemplates({ limit: 100 });
  const { data: actionTypes } = useActionTypes();
  const { data: userStrategies } = useUserStrategies();
  const { entities: registryEntities } = useEntityEngine();
  const templates = templatesData?.data ?? [];

  // Form state — basic
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Form state — trigger
  const [triggerType, setTriggerType] = useState<TriggerType>('event');
  const [eventName, setEventName] = useState('');
  const [delayAmount, setDelayAmount] = useState<number | undefined>();
  const [delayUnit, setDelayUnit] = useState<ScheduleUnit>('hours');
  const [scheduleEntityType, setScheduleEntityType] = useState('');
  const [scheduleDateField, setScheduleDateField] = useState('');
  const [scheduleDateOperator, setScheduleDateOperator] = useState<ScheduleDateOperator>('before');
  const [scheduleDateAmounts, setScheduleDateAmounts] = useState('');
  const [scheduleDateUnit, setScheduleDateUnit] = useState<ScheduleUnit>('days');
  const [scheduleDaysOfWeek, setScheduleDaysOfWeek] = useState<number[]>([]);

  // Form state — conditions & actions
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<ActionFormState[]>([emptyAction()]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Populate form from existing rule
  if (isEdit && existingRule && !initialized) {
    setName(existingRule.name);
    setDescription(existingRule.description ?? '');
    setTriggerType(existingRule.triggerType);
    setEventName(existingRule.eventName ?? '');
    setDelayAmount(existingRule.delayAmount ?? undefined);
    setDelayUnit((existingRule.delayUnit as ScheduleUnit) ?? 'hours');
    setScheduleEntityType(existingRule.scheduleEntityType ?? '');
    setScheduleDateField(existingRule.scheduleDateField ?? '');
    setScheduleDateOperator((existingRule.scheduleDateOperator as ScheduleDateOperator) ?? 'before');
    setScheduleDateAmounts(existingRule.scheduleDateAmounts?.join(', ') ?? '');
    setScheduleDateUnit((existingRule.scheduleDateUnit as ScheduleUnit) ?? 'days');
    setScheduleDaysOfWeek(existingRule.scheduleDaysOfWeek ?? []);
    setConditions(existingRule.conditions ?? []);
    setActions(
      existingRule.actions.length > 0
        ? existingRule.actions.map(actionToFormState)
        : [emptyAction()],
    );
    setInitialized(true);
  }

  // Derive entity type from event or schedule config
  const entityType = useMemo(() => {
    if (triggerType === 'event' && eventName) {
      const event = events?.find((e) => e.eventName === eventName);
      return event?.group ?? '';
    }
    return scheduleEntityType;
  }, [triggerType, eventName, scheduleEntityType, events]);

  const entityMeta = useMemo(() => {
    return entities?.find((e) => e.entityType === entityType);
  }, [entities, entityType]);

  const { data: entityFields } = useEntityFields(entityType || undefined);

  const conditionFields = useMemo<Record<string, FieldConfig>>(() => {
    return entityMeta?.fields ?? {};
  }, [entityMeta]);

  const hasConditionFields = Object.keys(conditionFields).length > 0 || (entityFields && entityFields.length > 0);

  const dateFields = useMemo(() => {
    if (!entityMeta) return [];
    return Object.entries(entityMeta.fields)
      .filter(([, config]) => config.type === 'date')
      .map(([key, config]) => ({ value: key, label: config.label }));
  }, [entityMeta]);

  const userFieldOptions = useMemo(() => {
    if (!entityMeta) return [];
    return Object.entries(entityMeta.userFields)
      .map(([key, config]) => ({ value: key, label: config.label }));
  }, [entityMeta]);

  const createMutation = useCreateAutomationRule({ onSuccess: () => navigate('/automations') });
  const updateMutation = useUpdateAutomationRule({ onSuccess: () => navigate('/automations') });

  const toggleDay = useCallback((day: number) => {
    setScheduleDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }, []);

  // Action helpers
  const updateAction = useCallback((index: number, patch: Partial<ActionFormState>) => {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }, []);

  const removeAction = useCallback((index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addAction = useCallback(() => {
    setActions((prev) => [...prev, emptyAction()]);
  }, []);

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const amounts = scheduleDateAmounts
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 0);

      const builtActions = actions
        .filter((a) => a.type)
        .map(formStateToAction);

      if (isEdit && id) {
        await updateMutation.mutateAsync({
          id,
          data: {
            name,
            description: description || undefined,
            conditions: conditions.length > 0 ? conditions : [],
            actions: builtActions,
          },
        });
      } else {
        await createMutation.mutateAsync({
          name,
          description: description || undefined,
          triggerType,
          ...(triggerType === 'event' && {
            eventName: eventName || undefined,
            delayAmount: delayAmount || undefined,
            delayUnit: delayAmount ? delayUnit : undefined,
          }),
          ...((triggerType === 'schedule_once' || triggerType === 'schedule_recurring') && {
            scheduleEntityType: scheduleEntityType || undefined,
            ...(scheduleDateField && {
              scheduleDateField,
              scheduleDateOperator,
              scheduleDateAmounts: amounts.length > 0 ? amounts : undefined,
              scheduleDateUnit,
            }),
            ...(scheduleDaysOfWeek.length > 0 && { scheduleDaysOfWeek }),
          }),
          conditions: conditions.length > 0 ? conditions : undefined,
          actions: builtActions,
        });
      }
    } catch {
      // errors handled by mutation hooks
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- Action type options for select ---
  // Generic entity actions are expanded into one option per registered entity,
  // using each entity's singularName for friendlier labels ("Create Task" instead
  // of a bare "Create Entity" that requires a second entity-type picker).
  const actionTypeOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (const at of actionTypes ?? []) {
      if (isEntityActionType(at.type)) {
        const verb = at.type === 'create_entity'
          ? 'Create'
          : at.type === 'update_entity'
            ? 'Update'
            : 'Delete';
        for (const entity of registryEntities) {
          options.push({
            value: `${at.type}:${entity.entityType}`,
            label: `${verb} ${entity.singularName}`,
          });
        }
        continue;
      }
      options.push({ value: at.type, label: at.label });
    }
    return options;
  }, [actionTypes, registryEntities]);

  const strategyOptions = useMemo(() => {
    return (userStrategies ?? []).map((s) => ({ value: s.type, label: s.label }));
  }, [userStrategies]);

  // Event options for select
  const eventOptions = useMemo(() => {
    return (events ?? []).map((ev) => ({ value: ev.eventName, label: `${ev.group}: ${ev.description}` }));
  }, [events]);

  const entityOptions = useMemo(() => {
    return (entities ?? []).map((e) => ({ value: e.entityType, label: e.entityType }));
  }, [entities]);

  return (
    <div className="max-w-3xl">
      <button
        type="button"
        onClick={() => navigate('/automations')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Automations
      </button>

      <h1 className="text-lg font-semibold text-foreground mb-6">
        {isEdit ? 'Edit Automation Rule' : 'Create Automation Rule'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Basic Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Welcome email on signup"
                required
                minLength={2}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-description">Description (optional)</Label>
              <Input
                id="rule-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this automation do?"
                maxLength={500}
              />
            </div>
          </CardContent>
        </Card>

        {/* Trigger */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Trigger</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!isEdit && (
              <div className="grid grid-cols-3 gap-2">
                {TRIGGER_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTriggerType(t.value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      triggerType === t.value
                        ? 'border-primary bg-primary/5'
                        : 'border-input hover:border-primary/50'
                    }`}
                  >
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                  </button>
                ))}
              </div>
            )}

            {isEdit && (
              <Badge variant="outline">{TRIGGER_TYPES.find((t) => t.value === triggerType)?.label}</Badge>
            )}

            {triggerType === 'event' && (
              <div className="space-y-3">
                <FormSelect
                  value={eventName}
                  onChange={(v) => setEventName(v)}
                  options={eventOptions}
                  label="Event"
                  placeholder="Select event..."
                  disabled={isEdit}
                />
                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground whitespace-nowrap">Delay (optional):</Label>
                  <Input
                    type="number"
                    value={delayAmount ?? ''}
                    onChange={(e) => setDelayAmount(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="0"
                    min={0}
                    className="w-20"
                  />
                  <FormSelect
                    value={delayUnit}
                    onChange={(v) => setDelayUnit(v as ScheduleUnit)}
                    options={[
                      { value: 'minutes', label: 'minutes' },
                      { value: 'hours', label: 'hours' },
                      { value: 'days', label: 'days' },
                    ]}
                    placeholder="unit"
                    className="w-32"
                  />
                </div>
              </div>
            )}

            {(triggerType === 'schedule_once' || triggerType === 'schedule_recurring') && (
              <div className="space-y-3">
                <FormSelect
                  value={scheduleEntityType}
                  onChange={(v) => { setScheduleEntityType(v); setScheduleDateField(''); }}
                  options={entityOptions}
                  label="Entity Type"
                  placeholder="Select entity..."
                  disabled={isEdit}
                />

                {dateFields.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <FormSelect
                      value={scheduleDateField}
                      onChange={(v) => setScheduleDateField(v)}
                      options={[
                        { value: '', label: 'No date anchor (condition-only)' },
                        ...dateFields,
                      ]}
                      placeholder="Date field..."
                    />

                    {scheduleDateField && (
                      <>
                        <Input
                          value={scheduleDateAmounts}
                          onChange={(e) => setScheduleDateAmounts(e.target.value)}
                          placeholder="7, 3, 1"
                          className="w-24"
                        />
                        <FormSelect
                          value={scheduleDateUnit}
                          onChange={(v) => setScheduleDateUnit(v as ScheduleUnit)}
                          options={[
                            { value: 'days', label: 'days' },
                            { value: 'hours', label: 'hours' },
                            { value: 'minutes', label: 'minutes' },
                          ]}
                          placeholder="unit"
                          className="w-32"
                        />
                        <FormSelect
                          value={scheduleDateOperator}
                          onChange={(v) => setScheduleDateOperator(v as ScheduleDateOperator)}
                          options={[
                            { value: 'before', label: 'before' },
                            { value: 'after', label: 'after' },
                          ]}
                          placeholder="operator"
                          className="w-28"
                        />
                      </>
                    )}
                  </div>
                )}

                {triggerType === 'schedule_recurring' && (
                  <div>
                    <Label className="mb-1">Run on days</Label>
                    <div className="flex gap-1">
                      {DAY_OPTIONS.map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            scheduleDaysOfWeek.includes(day.value)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {scheduleDaysOfWeek.length === 0 ? 'Runs every day' : `Runs on ${scheduleDaysOfWeek.map((d) => DAY_OPTIONS[d].label).join(', ')}`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conditions */}
        {hasConditionFields && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Conditions (optional)</CardTitle></CardHeader>
            <CardContent>
              <ConditionBuilder
                conditions={conditions}
                onChange={setConditions}
                fields={conditionFields}
                entityType={entityType || undefined}
                triggerType={triggerType}
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Actions</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addAction}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Action
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {actions.map((action, actionIndex) => (
              <ActionEditor
                key={actionIndex}
                action={action}
                index={actionIndex}
                actionTypeOptions={actionTypeOptions}
                actionTypes={actionTypes ?? []}
                strategyOptions={strategyOptions}
                userStrategies={userStrategies ?? []}
                userFieldOptions={userFieldOptions}
                templates={templates}
                canRemove={actions.length > 1}
                onChange={(patch) => updateAction(actionIndex, patch)}
                onRemove={() => removeAction(actionIndex)}
                sourceEntityType={entityType || undefined}
                entityOptions={entityOptions}
              />
            ))}
            {actions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Add at least one action for this automation.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Button type="button" variant="outline" onClick={() => navigate('/automations')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Rule'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// --- Action Editor ---

interface ActionEditorProps {
  action: ActionFormState;
  index: number;
  actionTypeOptions: { value: string; label: string }[];
  actionTypes: { type: string; label: string; userSlots: { name: string; label: string; required: boolean }[]; configSchema: Record<string, unknown> }[];
  strategyOptions: { value: string; label: string }[];
  userStrategies: { type: string; label: string; configSchema: Record<string, unknown> }[];
  userFieldOptions: { value: string; label: string }[];
  templates: { id: string; name: string; channel: string }[];
  canRemove: boolean;
  onChange: (patch: Partial<ActionFormState>) => void;
  onRemove: () => void;
  sourceEntityType?: string;
  entityOptions: { value: string; label: string }[];
}

function ActionEditor({
  action, index, actionTypeOptions, actionTypes, strategyOptions,
  userStrategies, userFieldOptions, templates, canRemove, onChange, onRemove, sourceEntityType,
  entityOptions,
}: ActionEditorProps) {
  const actionMeta = actionTypes.find((at) => at.type === action.type);
  const dropdownValue = actionDropdownValue(action.type, action.config);
  const lockedEntityType = isEntityActionType(action.type)
    ? ((action.config.entityType as string) ?? undefined)
    : undefined;

  const handleTypeChange = (value: string) => {
    const { type, entityType } = parseDropdownValue(value);
    const meta = actionTypes.find((at) => at.type === type);
    const defaultUsers: Record<string, UserResolution> = {};
    if (meta) {
      for (const slot of meta.userSlots) {
        defaultUsers[slot.name] = { strategy: 'actor', config: {} };
      }
    }
    const nextConfig: Record<string, unknown> = entityType ? { entityType } : {};
    onChange({ type, config: nextConfig, users: defaultUsers });
  };

  const handleUserSlotChange = (slotName: string, resolution: UserResolution) => {
    onChange({ users: { ...action.users, [slotName]: resolution } });
  };

  return (
    <div className="border border-input rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Action {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Remove action"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <FormSelect
        value={dropdownValue}
        onChange={handleTypeChange}
        options={actionTypeOptions}
        label="Action Type"
        placeholder="Select action..."
      />

      {/* Action-specific config */}
      {action.type === 'send_notification' && (
        <SendNotificationConfig
          config={action.config}
          onChange={(config) => onChange({ config })}
          templates={templates}
        />
      )}

      {action.type === 'create_entity' && (
        <EntityCreateActionConfig
          config={action.config}
          onChange={(config) => onChange({ config })}
          sourceEntityType={sourceEntityType}
          lockedEntityType={lockedEntityType}
        />
      )}

      {action.type === 'update_entity' && (
        <EntityUpdateActionConfig
          config={action.config}
          onChange={(config) => onChange({ config })}
          sourceEntityType={sourceEntityType}
          lockedEntityType={lockedEntityType}
        />
      )}

      {action.type === 'delete_entity' && (
        <EntityDeleteActionConfig
          config={action.config}
          onChange={(config) => onChange({ config })}
          lockedEntityType={lockedEntityType}
        />
      )}

      {action.type === 'transition_workflow' && (
        <TransitionWorkflowActionConfig
          config={action.config}
          onChange={(config) => onChange({ config })}
          sourceEntityType={sourceEntityType}
          entityOptions={entityOptions}
        />
      )}

      {action.type === 'tag_entity' && (
        <TagEntityActionConfig
          config={action.config}
          onChange={(config) => onChange({ config })}
          entityOptions={entityOptions}
        />
      )}

      {action.type && !['send_notification', 'create_entity', 'update_entity', 'delete_entity', 'transition_workflow', 'tag_entity'].includes(action.type) && (
        <GenericActionConfig
          config={action.config}
          onChange={(config) => onChange({ config })}
        />
      )}

      {/* User slots */}
      {actionMeta && actionMeta.userSlots.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-input">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            User Resolution
          </span>
          {actionMeta.userSlots.map((slot) => (
            <UserSlotEditor
              key={slot.name}
              slot={slot}
              resolution={action.users[slot.name] ?? { strategy: 'actor', config: {} }}
              strategyOptions={strategyOptions}
              userStrategies={userStrategies}
              userFieldOptions={userFieldOptions}
              onChange={(res) => handleUserSlotChange(slot.name, res)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Send Notification Config ---

interface SendNotificationConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  templates: { id: string; name: string; channel: string }[];
}

function SendNotificationConfig({ config, onChange, templates }: SendNotificationConfigProps) {
  const channels = getSendNotificationChannels(config);

  const enabledChannels = useMemo(() => {
    const set = new Set<string>();
    for (const ch of channels) set.add(ch.channel);
    return set;
  }, [channels]);

  const toggleChannel = (channel: NotificationChannel) => {
    if (enabledChannels.has(channel)) {
      onChange(setSendNotificationChannels(config, channels.filter((c) => c.channel !== channel)));
    } else {
      onChange(setSendNotificationChannels(config, [...channels, { channel, templateId: '' }]));
    }
  };

  const setTemplateForChannel = (channel: NotificationChannel, templateId: string) => {
    const updated = channels.map((c) =>
      c.channel === channel ? { ...c, templateId } : c,
    );
    onChange(setSendNotificationChannels(config, updated));
  };

  return (
    <div className="space-y-3">
      <Label>Channels &amp; Templates</Label>
      {CHANNELS.map((ch) => {
        const isEnabled = enabledChannels.has(ch);
        const channelTemplates = templates.filter((t) => t.channel === ch);
        const currentTemplateId = channels.find((c) => c.channel === ch)?.templateId ?? '';

        return (
          <div key={ch} className="flex items-center gap-3">
            <label className="flex items-center gap-2 min-w-[100px] cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={() => toggleChannel(ch)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm font-medium">{CHANNEL_LABELS[ch]}</span>
            </label>
            {isEnabled && (
              <FormSelect
                value={currentTemplateId}
                onChange={(v) => setTemplateForChannel(ch, v)}
                options={channelTemplates.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Select template..."
                className="flex-1"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Generic Action Config (JSON fallback) ---

function GenericActionConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const [raw, setRaw] = useState(() => JSON.stringify(config, null, 2));
  const [error, setError] = useState('');

  const handleBlur = () => {
    try {
      const parsed = JSON.parse(raw);
      onChange(parsed);
      setError('');
    } catch {
      setError('Invalid JSON');
    }
  };

  return (
    <div className="space-y-2">
      <Label>Action Config (JSON)</Label>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={handleBlur}
        rows={4}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// --- User Slot Editor ---

interface UserSlotEditorProps {
  slot: { name: string; label: string; required: boolean };
  resolution: UserResolution;
  strategyOptions: { value: string; label: string }[];
  userStrategies: { type: string; label: string; configSchema: Record<string, unknown> }[];
  userFieldOptions: { value: string; label: string }[];
  onChange: (resolution: UserResolution) => void;
}

function UserSlotEditor({ slot, resolution, strategyOptions, userStrategies, userFieldOptions, onChange }: UserSlotEditorProps) {
  const strategyMeta = userStrategies.find((s) => s.type === resolution.strategy);
  const configSchema = strategyMeta?.configSchema ?? {};

  const handleStrategyChange = (strategy: string) => {
    onChange({ strategy: strategy as UserResolution['strategy'], config: {} });
  };

  const handleConfigChange = (key: string, value: unknown) => {
    onChange({ ...resolution, config: { ...resolution.config, [key]: value } });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="min-w-[80px] text-muted-foreground">
          {slot.label}{slot.required && ' *'}
        </Label>
        <FormSelect
          value={resolution.strategy}
          onChange={handleStrategyChange}
          options={strategyOptions}
          placeholder="Select strategy..."
          className="flex-1"
        />
      </div>

      {/* Strategy-specific config fields */}
      {resolution.strategy === 'entity_field' && 'field' in configSchema && (
        <div className="ml-[calc(80px+0.5rem)]">
          <FormSelect
            value={(resolution.config?.field as string) ?? ''}
            onChange={(v) => handleConfigChange('field', v)}
            options={userFieldOptions}
            placeholder="Select user field..."
          />
        </div>
      )}

      {resolution.strategy === 'role' && 'roleId' in configSchema && (
        <div className="ml-[calc(80px+0.5rem)]">
          <Input
            value={(resolution.config?.roleId as string) ?? ''}
            onChange={(e) => handleConfigChange('roleId', e.target.value)}
            placeholder="Role ID"
          />
        </div>
      )}
    </div>
  );
}
