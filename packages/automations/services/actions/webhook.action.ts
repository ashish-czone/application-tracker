import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { QueueService } from '@packages/queue';
import Mustache from 'mustache';
import type { ActionHandler, ActionContext, ActionResult, UserSlotDefinition } from '../../types';

export const WEBHOOK_QUEUE_NAME = 'automation.webhook';

@Injectable()
export class WebhookAction implements ActionHandler {
  readonly type = 'webhook';
  readonly label = 'HTTP Webhook';
  readonly userSlots: UserSlotDefinition[] = [];
  readonly configSchema = {
    url: { type: 'string', required: true, label: 'URL' },
    method: { type: 'enum', options: ['POST', 'PUT', 'PATCH'], label: 'HTTP Method', default: 'POST' },
    headers: { type: 'object', label: 'Headers (optional)' },
    body: { type: 'object', label: 'Body Template (Mustache)' },
  };

  private readonly logger: ContextLogger;

  constructor(
    private readonly queueService: QueueService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(WebhookAction.name);
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const { url, method, headers, body } = context.actionConfig.config as {
      url?: string;
      method?: string;
      headers?: Record<string, string>;
      body?: Record<string, unknown>;
    };

    if (!url) {
      this.logger.warn(`No URL configured for webhook action in rule ${context.rule.id}`);
      return {};
    }

    const templateContext = {
      event: context.event,
      payload: context.event?.payload ?? {},
      rule: { id: context.rule.id, name: context.rule.name },
    };

    const resolvedUrl = url.includes('{{') ? Mustache.render(url, templateContext) : url;
    const resolvedBody = body ? interpolateObject(body, templateContext) : context.event?.payload ?? {};
    const resolvedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    };

    // Queue the HTTP call for reliability
    await this.queueService.enqueue(WEBHOOK_QUEUE_NAME, {
      url: resolvedUrl,
      method: (method ?? 'POST').toUpperCase(),
      headers: resolvedHeaders,
      body: resolvedBody,
      ruleId: context.rule.id,
      correlationId: context.event?.correlationId,
    });

    this.logger.debug('Webhook enqueued', { url: resolvedUrl, method, ruleId: context.rule.id });
    return {};
  }
}

function interpolateObject(obj: Record<string, unknown>, context: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.includes('{{')) {
      result[key] = Mustache.render(value, context);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = interpolateObject(value as Record<string, unknown>, context);
    } else {
      result[key] = value;
    }
  }
  return result;
}
