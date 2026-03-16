import { Injectable } from '@nestjs/common';
import Mustache from 'mustache';
import type { DomainEvent } from '@packages/events';
import type { NotificationTemplate, RenderedNotification } from '../types';

@Injectable()
export class TemplateRenderer {
  render(template: NotificationTemplate, event: DomainEvent): RenderedNotification {
    const context = {
      event: {
        eventName: event.eventName,
        entityType: event.entityType,
        entityId: event.entityId,
        actorId: event.actorId,
        occurredAt: event.occurredAt,
      },
      payload: event.payload,
    };

    return {
      title: template.subject ? Mustache.render(template.subject, context) : template.name,
      body: Mustache.render(template.body, context),
      subject: template.subject ? Mustache.render(template.subject, context) : undefined,
    };
  }
}
