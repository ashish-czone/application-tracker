import type { INestApplicationContext } from '@nestjs/common';
import type { SeedSource } from '@packages/database/seeder';
import { NotificationTemplatesService } from '@packages/notifications';
import { AutomationRuleService } from '@packages/automations';

import { NOTES_NOTE_MENTIONED } from '../events/types';

/**
 * Notes system seed — one in-app notification rule per Q30.
 *
 * The rule fires on `notes.NoteMentioned`, which the notes service emits only
 * for *newly added* mentions (the service handles the create/update diff so a
 * reviewer who was mentioned earlier doesn't get re-notified on every edit).
 * Self-mentions are filtered at the emit site, not here.
 *
 * Channel is `in_app` only in V1 — email delivery for mentions is deferred
 * (Q30) to avoid inbox fatigue while firms establish mention norms.
 */

const MENTION_TEMPLATE_NAME = 'notes-mention-in-app';
const MENTION_RULE_NAME = 'notes-mention-in-app-notification';

export const seedSystem = async (ctx: INestApplicationContext): Promise<void> => {
  const templatesService = ctx.get(NotificationTemplatesService);
  const ruleService = ctx.get(AutomationRuleService);

  const existingTemplate = await templatesService.findFirstByName(MENTION_TEMPLATE_NAME);
  const template = existingTemplate
    ?? (await templatesService.create({
      name: MENTION_TEMPLATE_NAME,
      channel: 'in_app',
      subject: 'You were mentioned in a note',
      body: '{{payload.contentPreview}}',
    }));

  const existingRule = await ruleService.findFirstByName(MENTION_RULE_NAME);
  if (existingRule) return;

  await ruleService.create({
    name: MENTION_RULE_NAME,
    description: 'Notify users in-app when they are newly mentioned in a note.',
    triggerType: 'event',
    eventName: NOTES_NOTE_MENTIONED,
    conditions: [],
    actions: [
      {
        type: 'send_notification',
        users: {
          recipient: { strategy: 'entity_field', config: { field: 'newMentionedUserIds' } },
        },
        config: {
          channels: [{ channel: 'in_app', templateId: template.id }],
        },
      },
    ],
  });
};

/**
 * Seed source list for apps that mount `NotesModule`. Notes is an addon, so
 * it is not part of `platformSystemSeedSources()`. Apps that depend on notes
 * must spread this into their own seed.ts CLI to get the mention rule.
 */
export function notesSystemSeedSources(): SeedSource[] {
  return [
    {
      name: '@packages/notes',
      kind: 'system',
      load: async () => seedSystem,
    },
  ];
}
