import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CredentialsRelationHandler } from '../credentials-relation-handler';

function buildHandler() {
  const credentialsService = {
    createPasswordCredential: vi.fn().mockResolvedValue({ id: 'cred-1' }),
    updateSecretHash: vi.fn().mockResolvedValue(undefined),
  };
  const handler = new CredentialsRelationHandler(credentialsService as any);
  return { handler, credentialsService };
}

const fakeTx = { insert: vi.fn() } as unknown;
const actorId = 'actor-1';

describe('CredentialsRelationHandler', () => {
  describe('onCreate', () => {
    it('creates a password credential using parent.email as identifier', async () => {
      const { handler, credentialsService } = buildHandler();

      await handler.onCreate(fakeTx, 'user-1', { password: 'p@ssw0rd' }, actorId, {
        parent: { email: 'User@Example.com', firstName: 'Jane' },
      });

      expect(credentialsService.createPasswordCredential).toHaveBeenCalledWith(
        'user-1',
        'user@example.com',
        'p@ssw0rd',
        fakeTx,
      );
    });

    it('throws BadRequest when password is missing', async () => {
      const { handler, credentialsService } = buildHandler();

      await expect(
        handler.onCreate(fakeTx, 'user-1', {}, actorId, { parent: { email: 'u@e.com' } }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(credentialsService.createPasswordCredential).not.toHaveBeenCalled();
    });

    it('throws BadRequest when parent has no email', async () => {
      const { handler, credentialsService } = buildHandler();

      await expect(
        handler.onCreate(fakeTx, 'user-1', { password: 'x' }, actorId, { parent: {} }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(credentialsService.createPasswordCredential).not.toHaveBeenCalled();
    });

    it('throws BadRequest for non-string password', async () => {
      const { handler } = buildHandler();

      await expect(
        handler.onCreate(fakeTx, 'user-1', { password: 123 }, actorId, { parent: { email: 'u@e.com' } }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('onUpdate', () => {
    it('rotates password hash when password is present in payload', async () => {
      const { handler, credentialsService } = buildHandler();

      await handler.onUpdate(fakeTx, 'user-1', { password: 'newpass' }, actorId, {
        parent: { email: 'u@e.com' },
      });

      expect(credentialsService.updateSecretHash).toHaveBeenCalledWith(
        'user-1',
        'password',
        'newpass',
        fakeTx,
      );
    });

    it('is a no-op when payload has no password', async () => {
      const { handler, credentialsService } = buildHandler();

      await handler.onUpdate(fakeTx, 'user-1', {}, actorId, { parent: { email: 'u@e.com' } });

      expect(credentialsService.updateSecretHash).not.toHaveBeenCalled();
    });
  });

  describe('onDelete', () => {
    it('is a no-op regardless of kind', async () => {
      const { handler, credentialsService } = buildHandler();

      await handler.onDelete(fakeTx, 'user-1', actorId, { kind: 'soft' }, { parent: {} });
      await handler.onDelete(fakeTx, 'user-1', actorId, { kind: 'hard' }, { parent: {} });

      expect(credentialsService.updateSecretHash).not.toHaveBeenCalled();
      expect(credentialsService.createPasswordCredential).not.toHaveBeenCalled();
    });
  });
});
