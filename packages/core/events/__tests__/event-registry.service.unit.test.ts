import { describe, it, expect, beforeEach } from 'vitest';
import { EventRegistryService, type EventMetadata } from '../event-registry.service';

function createMetadata(overrides: Partial<EventMetadata> = {}): EventMetadata {
  return {
    eventName: 'test.EntityCreated',
    group: 'test',
    description: 'A test entity was created',
    payloadSchema: {
      name: { type: 'string', label: 'Name' },
    },
    ...overrides,
  };
}

describe('EventRegistryService', () => {
  let registry: EventRegistryService;

  beforeEach(() => {
    registry = new EventRegistryService();
  });

  describe('register', () => {
    it('should register an event and make it retrievable via get()', () => {
      const metadata = createMetadata();
      registry.register(metadata);

      expect(registry.get('test.EntityCreated')).toEqual(metadata);
    });

    it('should overwrite an existing event with the same eventName', () => {
      const original = createMetadata({ description: 'Original' });
      const updated = createMetadata({ description: 'Updated' });

      registry.register(original);
      registry.register(updated);

      expect(registry.get('test.EntityCreated')).toEqual(updated);
      expect(registry.getAll()).toHaveLength(1);
    });

    it('should register multiple events with different names', () => {
      const created = createMetadata({ eventName: 'test.EntityCreated' });
      const updated = createMetadata({ eventName: 'test.EntityUpdated', description: 'Updated' });
      const deleted = createMetadata({ eventName: 'test.EntityDeleted', description: 'Deleted' });

      registry.register(created);
      registry.register(updated);
      registry.register(deleted);

      expect(registry.getAll()).toHaveLength(3);
    });
  });

  describe('get', () => {
    it('should return undefined for an unregistered event', () => {
      expect(registry.get('nonexistent.Event')).toBeUndefined();
    });

    it('should return the correct metadata for a registered event', () => {
      const metadata = createMetadata({
        eventName: 'orders.OrderPlaced',
        group: 'orders',
        description: 'An order was placed',
        payloadSchema: {
          orderId: { type: 'string', label: 'Order ID' },
          total: { type: 'number', label: 'Total' },
        },
      });

      registry.register(metadata);

      const result = registry.get('orders.OrderPlaced');
      expect(result).toEqual(metadata);
      expect(result?.payloadSchema).toEqual({
        orderId: { type: 'string', label: 'Order ID' },
        total: { type: 'number', label: 'Total' },
      });
    });
  });

  describe('getAll', () => {
    it('should return an empty array when no events are registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered events', () => {
      const a = createMetadata({ eventName: 'a.Created', group: 'a' });
      const b = createMetadata({ eventName: 'b.Updated', group: 'b' });

      registry.register(a);
      registry.register(b);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual(a);
      expect(all).toContainEqual(b);
    });

    it('should return a new array instance each call (not the internal Map)', () => {
      registry.register(createMetadata());

      const first = registry.getAll();
      const second = registry.getAll();

      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });

    it('should reflect registrations made after a previous getAll() call', () => {
      registry.register(createMetadata({ eventName: 'first.Event' }));
      expect(registry.getAll()).toHaveLength(1);

      registry.register(createMetadata({ eventName: 'second.Event' }));
      expect(registry.getAll()).toHaveLength(2);
    });
  });
});
