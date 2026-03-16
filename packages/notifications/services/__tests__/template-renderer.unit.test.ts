import { describe, it, expect } from 'vitest';
import { TemplateRenderer } from '../template-renderer';
import type { DomainEvent } from '@packages/events';
import type { NotificationTemplate } from '../../types';

function buildEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventName: 'users.UserCreated',
    entityType: 'users',
    entityId: 'user-1',
    actorId: 'actor-1',
    correlationId: 'corr-1',
    occurredAt: '2026-01-01T00:00:00Z',
    payload: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
    ...overrides,
  };
}

function buildTemplate(overrides: Partial<NotificationTemplate> = {}): NotificationTemplate {
  return {
    id: 'tmpl-1',
    name: 'Welcome',
    channel: 'email',
    subject: 'Welcome {{payload.firstName}}!',
    body: 'Hello {{payload.firstName}} {{payload.lastName}}, your account ({{payload.email}}) is ready.',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TemplateRenderer', () => {
  const renderer = new TemplateRenderer();

  it('should render subject and body with event payload', () => {
    const result = renderer.render(buildTemplate(), buildEvent());

    expect(result.subject).toBe('Welcome John!');
    expect(result.body).toBe('Hello John Doe, your account (john@example.com) is ready.');
    expect(result.title).toBe('Welcome John!');
  });

  it('should use template name as title when no subject', () => {
    const template = buildTemplate({ subject: null });
    const result = renderer.render(template, buildEvent());

    expect(result.title).toBe('Welcome');
    expect(result.subject).toBeUndefined();
  });

  it('should render event metadata in templates', () => {
    const template = buildTemplate({
      subject: null,
      body: 'Event {{event.eventName}} on {{event.entityType}} {{event.entityId}}',
    });

    const result = renderer.render(template, buildEvent());

    expect(result.body).toBe('Event users.UserCreated on users user-1');
  });

  it('should handle missing payload fields gracefully', () => {
    const template = buildTemplate({
      body: 'Hello {{payload.unknown}}!',
      subject: null,
    });

    const result = renderer.render(template, buildEvent());

    expect(result.body).toBe('Hello !');
  });
});
