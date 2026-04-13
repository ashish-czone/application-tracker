import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as bcrypt from 'bcrypt';
import { CredentialsService } from '../credentials.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

function createMockDatabaseService() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  return {
    db: chain,
    _chain: chain,
  };
}

describe('CredentialsService', () => {
  let service: CredentialsService;
  let mockDatabase: ReturnType<typeof createMockDatabaseService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabase = createMockDatabaseService();
    service = new CredentialsService(mockDatabase as any);
  });

  describe('findByProviderAndIdentifier', () => {
    it('should return credential when found', async () => {
      const credential = {
        id: 'cred-1',
        userId: 'u1',
        provider: 'password',
        identifier: 'user@test.com',
        secretHash: 'hashed-password',
      };
      mockDatabase._chain.limit.mockResolvedValue([credential]);

      const result = await service.findByProviderAndIdentifier('password', 'user@test.com');

      expect(result).toEqual(credential);
      expect(mockDatabase._chain.select).toHaveBeenCalled();
      expect(mockDatabase._chain.from).toHaveBeenCalled();
      expect(mockDatabase._chain.where).toHaveBeenCalled();
      expect(mockDatabase._chain.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when no credential found', async () => {
      mockDatabase._chain.limit.mockResolvedValue([]);

      const result = await service.findByProviderAndIdentifier('password', 'unknown@test.com');

      expect(result).toBeNull();
    });

    it('should return null when query returns undefined first element', async () => {
      mockDatabase._chain.limit.mockResolvedValue([undefined]);

      const result = await service.findByProviderAndIdentifier('password', 'unknown@test.com');

      expect(result).toBeNull();
    });

    it('should query with both provider and identifier', async () => {
      mockDatabase._chain.limit.mockResolvedValue([]);

      await service.findByProviderAndIdentifier('google', 'google-id-123');

      expect(mockDatabase._chain.where).toHaveBeenCalled();
    });
  });

  describe('findByUserId', () => {
    it('should return all credentials for a user', async () => {
      const userCredentials = [
        { id: 'cred-1', userId: 'u1', provider: 'password', identifier: 'user@test.com' },
        { id: 'cred-2', userId: 'u1', provider: 'google', identifier: 'google-123' },
      ];
      mockDatabase._chain.where.mockResolvedValue(userCredentials);

      const result = await service.findByUserId('u1');

      expect(result).toEqual(userCredentials);
      expect(mockDatabase._chain.select).toHaveBeenCalled();
      expect(mockDatabase._chain.from).toHaveBeenCalled();
      expect(mockDatabase._chain.where).toHaveBeenCalled();
    });

    it('should return empty array when user has no credentials', async () => {
      mockDatabase._chain.where.mockResolvedValue([]);

      const result = await service.findByUserId('u-no-creds');

      expect(result).toEqual([]);
    });
  });

  describe('createPasswordCredential', () => {
    it('should hash password with bcrypt and insert credential', async () => {
      const hashedPassword = '$2b$12$hashedvalue';
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as never);

      const insertedCredential = {
        id: 'cred-new',
        userId: 'u1',
        provider: 'password',
        identifier: 'user@test.com',
        secretHash: hashedPassword,
      };
      mockDatabase._chain.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([insertedCredential]),
        }),
      });

      const result = await service.createPasswordCredential('u1', 'user@test.com', 'plain-password');

      expect(bcrypt.hash).toHaveBeenCalledWith('plain-password', 12);
      expect(result).toEqual(insertedCredential);
    });

    it('should use 12 salt rounds for bcrypt hashing', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as never);
      mockDatabase._chain.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'cred-1' }]),
        }),
      });

      await service.createPasswordCredential('u1', 'user@test.com', 'password');

      expect(bcrypt.hash).toHaveBeenCalledWith('password', 12);
    });

    it('should set provider to "password"', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as never);
      const mockValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'cred-1' }]),
      });
      mockDatabase._chain.insert.mockReturnValue({ values: mockValues });

      await service.createPasswordCredential('u1', 'user@test.com', 'password');

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'password',
          userId: 'u1',
          identifier: 'user@test.com',
          secretHash: 'hashed',
        }),
      );
    });

    it('should use provided transaction when tx is passed', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as never);

      const txInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'cred-tx' }]),
        }),
      });
      const tx = { insert: txInsert } as any;

      const result = await service.createPasswordCredential('u1', 'user@test.com', 'password', tx);

      expect(txInsert).toHaveBeenCalled();
      expect(mockDatabase._chain.insert).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'cred-tx' });
    });

    it('should use default database when tx is not provided', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as never);
      mockDatabase._chain.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'cred-db' }]),
        }),
      });

      await service.createPasswordCredential('u1', 'user@test.com', 'password');

      expect(mockDatabase._chain.insert).toHaveBeenCalled();
    });
  });

  describe('verifyPassword', () => {
    it('should return true when password matches hash', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await service.verifyPassword('$2b$12$storedhash', 'correct-password');

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('correct-password', '$2b$12$storedhash');
    });

    it('should return false when password does not match hash', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await service.verifyPassword('$2b$12$storedhash', 'wrong-password');

      expect(result).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', '$2b$12$storedhash');
    });

    it('should pass plaintext as first arg and secretHash as second arg to bcrypt.compare', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await service.verifyPassword('the-hash', 'the-plaintext');

      // bcrypt.compare(plaintext, hash) — order matters
      expect(bcrypt.compare).toHaveBeenCalledWith('the-plaintext', 'the-hash');
    });
  });

  describe('updateSecretHash', () => {
    it('should hash new password and update credential', async () => {
      const newHash = '$2b$12$newhash';
      vi.mocked(bcrypt.hash).mockResolvedValue(newHash as never);

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDatabase._chain.update.mockReturnValue({ set: mockSet });

      await service.updateSecretHash('u1', 'password', 'new-password');

      expect(bcrypt.hash).toHaveBeenCalledWith('new-password', 12);
      expect(mockDatabase._chain.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ secretHash: newHash });
    });

    it('should use 12 salt rounds when hashing new password', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as never);

      await service.updateSecretHash('u1', 'password', 'new-pass');

      expect(bcrypt.hash).toHaveBeenCalledWith('new-pass', 12);
    });

    it('should use provided transaction when tx is passed', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as never);

      const txUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      const tx = { update: txUpdate } as any;

      await service.updateSecretHash('u1', 'password', 'new-pass', tx);

      expect(txUpdate).toHaveBeenCalled();
      expect(mockDatabase._chain.update).not.toHaveBeenCalled();
    });

    it('should use default database when tx is not provided', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as never);

      await service.updateSecretHash('u1', 'password', 'new-pass');

      expect(mockDatabase._chain.update).toHaveBeenCalled();
    });

    it('should filter by both userId and provider', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as never);

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      mockDatabase._chain.update.mockReturnValue({
        set: vi.fn().mockReturnValue({ where: mockWhere }),
      });

      await service.updateSecretHash('u1', 'password', 'new-pass');

      expect(mockWhere).toHaveBeenCalled();
    });
  });
});
