import { Injectable } from '@nestjs/common';

export interface EventMetadata {
  eventName: string;
  group: string;
  description: string;
  payloadSchema: Record<string, { type: string; label: string }>;
}

@Injectable()
export class EventRegistryService {
  private readonly events = new Map<string, EventMetadata>();

  register(metadata: EventMetadata): void {
    this.events.set(metadata.eventName, metadata);
  }

  getAll(): EventMetadata[] {
    return Array.from(this.events.values());
  }

  get(eventName: string): EventMetadata | undefined {
    return this.events.get(eventName);
  }
}
