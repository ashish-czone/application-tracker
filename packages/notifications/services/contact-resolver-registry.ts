import { Injectable, Logger } from '@nestjs/common';

export type ContactResolverFn = (userId: string) => Promise<string | null>;

@Injectable()
export class ContactResolverRegistry {
  private readonly logger = new Logger(ContactResolverRegistry.name);
  private readonly resolvers = new Map<string, ContactResolverFn>();

  /**
   * Register a contact resolver for a notification channel.
   * Called by domain modules in onModuleInit.
   *
   * @example
   * contactResolverRegistry.register('email', (userId) => usersService.getEmail(userId));
   * contactResolverRegistry.register('whatsapp', (userId) => contactsService.getPhone(userId));
   */
  register(channel: string, resolver: ContactResolverFn): void {
    this.resolvers.set(channel, resolver);
    this.logger.log(`Registered contact resolver for channel: ${channel}`);
  }

  async resolve(channel: string, userId: string): Promise<string | null> {
    const resolver = this.resolvers.get(channel);
    if (!resolver) {
      this.logger.warn(`No contact resolver registered for channel "${channel}"`);
      return null;
    }
    return resolver(userId);
  }

  has(channel: string): boolean {
    return this.resolvers.has(channel);
  }
}
