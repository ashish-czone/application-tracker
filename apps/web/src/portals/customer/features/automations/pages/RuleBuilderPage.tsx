import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@packages/ui';
import { useRule, useCreateRule, useUpdateRule, useEvents, useEntities, useTemplates } from '../hooks';
import { setRuleChannels } from '../services';
import { ConditionBuilder } from '../components/ConditionBuilder';
import type {
  TriggerType, RecipientStrategy, NotificationChannel,
  Condition, RuleChannel, FieldConfig,
} from '../types';

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

export default function RuleBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existingRule } = useRule(id ?? '');
  const { data: events } = useEvents();
  const { data: entities } = useEntities();
  const { data: templatesData } = useTemplates({ limit: 100 });
  const templates = templatesData?.data ?? [];

  // Form state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('event');
  const [eventName, setEventName] = useState('');
  const [delayAmount, setDelayAmount] = useState<number | undefined>();
  const [delayUnit, setDelayUnit] = useState<string>('hours');
  const [scheduleEntityType, setScheduleEntityType] = useState('');
  const [scheduleDateField, setScheduleDateField] = useState('');
  const [scheduleDateOperator, setScheduleDateOperator] = useState<string>('before');
  const [scheduleDateAmounts, setScheduleDateAmounts] = useState('');
  const [scheduleDateUnit, setScheduleDateUnit] = useState<string>('days');
  const [scheduleDaysOfWeek, setScheduleDaysOfWeek] = useState<number[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [recipientStrategy, setRecipientStrategy] = useState<RecipientStrategy>('actor');
  const [recipientField, setRecipientField] = useState('');
  const [recipientRoleId, setRecipientRoleId] = useState('');
  const [channels, setChannels] = useState<Record<NotificationChannel, { enabled: boolean; templateId: string }>>({
    email: { enabled: false, templateId: '' },
    in_app: { enabled: false, templateId: '' },
    whatsapp: { enabled: false, templateId: '' },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Populate form from existing rule
  if (isEdit && existingRule && !initialized) {
    setName(existingRule.name);
    setTriggerType(existingRule.triggerType);
    setEventName(existingRule.eventName ?? '');
    setDelayAmount(existingRule.delayAmount ?? undefined);
    setDelayUnit(existingRule.delayUnit ?? 'hours');
    setScheduleEntityType(existingRule.scheduleEntityType ?? '');
    setScheduleDateField(existingRule.scheduleDateField ?? '');
    setScheduleDateOperator(existingRule.scheduleDateOperator ?? 'before');
    setScheduleDateAmounts(existingRule.scheduleDateAmounts?.join(', ') ?? '');
    setScheduleDateUnit(existingRule.scheduleDateUnit ?? 'days');
    setScheduleDaysOfWeek(existingRule.scheduleDaysOfWeek ?? []);
    setConditions(existingRule.conditions ?? []);
    setRecipientStrategy(existingRule.recipientStrategy);
    setRecipientField((existingRule.recipientConfig as any)?.field ?? '');
    setRecipientRoleId((existingRule.recipientConfig as any)?.roleId ?? '');
    const ch: any = { email: { enabled: false, templateId: '' }, in_app: { enabled: false, templateId: '' }, whatsapp: { enabled: false, templateId: '' } };
    for (const rc of existingRule.channels ?? []) {
      ch[rc.channel] = { enabled: true, templateId: rc.templateId };
    }
    setChannels(ch);
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

  const conditionFields = useMemo<Record<string, FieldConfig>>(() => {
    return entityMeta?.fields ?? {};
  }, [entityMeta]);

  const dateFields = useMemo(() => {
    if (!entityMeta) return [];
    return Object.entries(entityMeta.fields)
      .filter(([, config]) => config.type === 'date')
      .map(([key, config]) => ({ value: key, label: config.label }));
  }, [entityMeta]);

  const recipientFields = useMemo(() => {
    if (!entityMeta) return [];
    return Object.entries(entityMeta.recipientFields)
      .map(([key, config]) => ({ value: key, label: config.label }));
  }, [entityMeta]);

  const createMutation = useCreateRule({ onSuccess: () => navigate('/automations') });
  const updateMutation = useUpdateRule({ onSuccess: () => navigate('/automations') });

  const toggleDay = useCallback((day: number) => {
    setScheduleDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const ruleChannels: RuleChannel[] = CHANNELS
        .filter((ch) => channels[ch].enabled && channels[ch].templateId)
        .map((ch) => ({ channel: ch, templateId: channels[ch].templateId }));

      const recipientConfig: Record<string, unknown> = {};
      if (recipientStrategy === 'entity_owner' && recipientField) recipientConfig.field = recipientField;
      if (recipientStrategy === 'role' && recipientRoleId) recipientConfig.roleId = recipientRoleId;

      const amounts = scheduleDateAmounts
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 0);

      if (isEdit && id) {
        await updateMutation.mutateAsync({
          id,
          data: {
            name,
            recipientStrategy,
            recipientConfig: Object.keys(recipientConfig).length > 0 ? recipientConfig : undefined,
            conditions: conditions.length > 0 ? conditions : undefined,
            scheduleDaysOfWeek: scheduleDaysOfWeek.length > 0 ? scheduleDaysOfWeek : undefined,
          },
        });
        await setRuleChannels(id, ruleChannels);
      } else {
        await createMutation.mutateAsync({
          name,
          triggerType,
          ...(triggerType === 'event' && {
            eventName: eventName || undefined,
            delayAmount: delayAmount || undefined,
            delayUnit: delayAmount ? delayUnit as any : undefined,
          }),
          ...((triggerType === 'schedule_once' || triggerType === 'schedule_recurring') && {
            scheduleEntityType: scheduleEntityType || undefined,
            ...(scheduleDateField && {
              scheduleDateField,
              scheduleDateOperator: scheduleDateOperator as any,
              scheduleDateAmounts: amounts.length > 0 ? amounts : undefined,
              scheduleDateUnit: scheduleDateUnit as any,
            }),
            ...(scheduleDaysOfWeek.length > 0 && { scheduleDaysOfWeek }),
          }),
          conditions: conditions.length > 0 ? conditions : undefined,
          recipientStrategy,
          recipientConfig: Object.keys(recipientConfig).length > 0 ? recipientConfig : undefined,
          channels: ruleChannels,
        });
      }
    } catch {
      // errors handled by mutation hooks
    } finally {
      setIsSubmitting(false);
    }
  }

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
        {/* Name */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Basic Info</CardTitle></CardHeader>
          <CardContent>
            <label className="block text-sm font-medium text-foreground mb-1">Rule Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Welcome email on signup"
              required
              minLength={2}
              maxLength={200}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
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
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Event</label>
                  <select
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    disabled={isEdit}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select event...</option>
                    {(events ?? []).map((ev) => (
                      <option key={ev.eventName} value={ev.eventName}>
                        {ev.group}: {ev.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">Delay (optional):</label>
                  <input
                    type="number"
                    value={delayAmount ?? ''}
                    onChange={(e) => setDelayAmount(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="0"
                    min={0}
                    className="w-20 h-9 rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <select
                    value={delayUnit}
                    onChange={(e) => setDelayUnit(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </div>
              </div>
            )}

            {(triggerType === 'schedule_once' || triggerType === 'schedule_recurring') && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Entity Type</label>
                  <select
                    value={scheduleEntityType}
                    onChange={(e) => { setScheduleEntityType(e.target.value); setScheduleDateField(''); }}
                    disabled={isEdit}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select entity...</option>
                    {(entities ?? []).map((e) => (
                      <option key={e.entityType} value={e.entityType}>{e.entityType}</option>
                    ))}
                  </select>
                </div>

                {dateFields.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={scheduleDateField}
                      onChange={(e) => setScheduleDateField(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">No date anchor (condition-only)</option>
                      {dateFields.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>

                    {scheduleDateField && (
                      <>
                        <input
                          value={scheduleDateAmounts}
                          onChange={(e) => setScheduleDateAmounts(e.target.value)}
                          placeholder="7, 3, 1"
                          className="w-24 h-9 rounded-md border border-input bg-background px-3 text-sm"
                        />
                        <select
                          value={scheduleDateUnit}
                          onChange={(e) => setScheduleDateUnit(e.target.value)}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="days">days</option>
                          <option value="hours">hours</option>
                          <option value="minutes">minutes</option>
                        </select>
                        <select
                          value={scheduleDateOperator}
                          onChange={(e) => setScheduleDateOperator(e.target.value)}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="before">before</option>
                          <option value="after">after</option>
                        </select>
                      </>
                    )}
                  </div>
                )}

                {triggerType === 'schedule_recurring' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Run on days</label>
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
        {Object.keys(conditionFields).length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Conditions (optional)</CardTitle></CardHeader>
            <CardContent>
              <ConditionBuilder conditions={conditions} onChange={setConditions} fields={conditionFields} />
            </CardContent>
          </Card>
        )}

        {/* Recipients */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Recipients</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <select
              value={recipientStrategy}
              onChange={(e) => setRecipientStrategy(e.target.value as RecipientStrategy)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="actor">Actor (user who triggered the event)</option>
              <option value="entity_owner">Entity Owner (field on the entity)</option>
              <option value="role">All users with a specific role</option>
            </select>

            {recipientStrategy === 'entity_owner' && recipientFields.length > 0 && (
              <select
                value={recipientField}
                onChange={(e) => setRecipientField(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select recipient field...</option>
                {recipientFields.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            )}

            {recipientStrategy === 'role' && (
              <input
                value={recipientRoleId}
                onChange={(e) => setRecipientRoleId(e.target.value)}
                placeholder="Role ID"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            )}
          </CardContent>
        </Card>

        {/* Channels + Templates */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Channels &amp; Templates</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {CHANNELS.map((ch) => {
              const channelTemplates = templates.filter((t) => t.channel === ch);
              return (
                <div key={ch} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 min-w-[100px]">
                    <input
                      type="checkbox"
                      checked={channels[ch].enabled}
                      onChange={(e) => setChannels((prev) => ({
                        ...prev,
                        [ch]: { ...prev[ch], enabled: e.target.checked },
                      }))}
                      className="rounded border-input"
                    />
                    <span className="text-sm font-medium">{CHANNEL_LABELS[ch]}</span>
                  </label>
                  {channels[ch].enabled && (
                    <select
                      value={channels[ch].templateId}
                      onChange={(e) => setChannels((prev) => ({
                        ...prev,
                        [ch]: { ...prev[ch], templateId: e.target.value },
                      }))}
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select template...</option>
                      {channelTemplates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Actions */}
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
