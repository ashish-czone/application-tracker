import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, and, type DrizzleDB } from '@packages/database';
import * as bcrypt from 'bcrypt';
import { credentials } from '../schema';

const SALT_ROUNDS = 12;

@Injectable()
export class CredentialsService {
  constructor(private readonly database: DatabaseService) {}

  async findByProviderAndIdentifier(provider: string, identifier: string) {
    const [credential] = await this.database.db
      .select()
      .from(credentials)
      .where(and(eq(credentials.provider, provider), eq(credentials.identifier, identifier)))
      .limit(1);

    return credential ?? null;
  }

  async findByUserId(userId: string) {
    return this.database.db
      .select()
      .from(credentials)
      .where(eq(credentials.userId, userId));
  }

  async createPasswordCredential(userId: string, identifier: string, password: string, tx?: DrizzleDB) {
    const db = tx ?? this.database.db;
    const secretHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [credential] = await db
      .insert(credentials)
      .values({
        userId,
        provider: 'password',
        identifier,
        secretHash,
      })
      .returning();

    return credential;
  }

  async createCredential(userId: string, provider: string, identifier: string, tx?: DrizzleDB) {
    const db = tx ?? this.database.db;

    const [credential] = await db
      .insert(credentials)
      .values({
        userId,
        provider,
        identifier,
      })
      .returning();

    return credential;
  }

  async verifyPassword(secretHash: string, plaintext: string): Promise<boolean> {
    return bcrypt.compare(plaintext, secretHash);
  }

  async updateSecretHash(userId: string, provider: string, newPassword: string, tx?: DrizzleDB) {
    const db = tx ?? this.database.db;
    const secretHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await db
      .update(credentials)
      .set({ secretHash })
      .where(and(eq(credentials.userId, userId), eq(credentials.provider, provider)));
  }
}
