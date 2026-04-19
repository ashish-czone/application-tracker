import { Injectable } from '@nestjs/common';
import type { TemplatePlaceholderProvider, PlaceholderDefinition } from '../types';

@Injectable()
export class TemplateProviderRegistry {
  private readonly providers = new Map<string, TemplatePlaceholderProvider>();

  register(provider: TemplatePlaceholderProvider): void {
    this.providers.set(provider.category, provider);
  }

  get(category: string): TemplatePlaceholderProvider | undefined {
    return this.providers.get(category);
  }

  has(category: string): boolean {
    return this.providers.has(category);
  }

  getPlaceholders(category: string): PlaceholderDefinition[] {
    return this.providers.get(category)?.getPlaceholders() ?? [];
  }

  getRegisteredCategories(): string[] {
    return Array.from(this.providers.keys());
  }
}
