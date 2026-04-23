import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { users } from '@packages/database/schema';
import { OrgUnitService } from '../org-unit.service';
import { OrgPositionService } from '../org-position.service';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('OrgUnit Services (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let orgUnitService: OrgUnitService;
  let positionService: OrgPositionService;

  beforeAll(async () => {
    const ctx = await createPlatformTestModule({
      providers: [OrgUnitService, OrgPositionService],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    orgUnitService = module.get(OrgUnitService);
    positionService = module.get(OrgPositionService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  async function createUser(firstName = 'Test'): Promise<string> {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      email: `user-${id.slice(0, 8)}@test.com`,
      firstName,
      lastName: 'User',
      userType: 'internal',
    });
    return id;
  }

  // ==================== OrgUnitService ====================

  describe('OrgUnitService', () => {
    describe('create', () => {
      it('should create an org unit', async () => {
        const unit = await orgUnitService.create({ name: 'Engineering' });

        expect(unit.id).toBeDefined();
        expect(unit.name).toBe('Engineering');
        expect(unit.type).toBe('team');
        expect(unit.parentId).toBeNull();
      });

      it('should create a child org unit', async () => {
        const parent = await orgUnitService.create({ name: 'Engineering' });
        const child = await orgUnitService.create({ name: 'Frontend', parentId: parent.id });

        expect(child.parentId).toBe(parent.id);
      });
    });

    describe('findAll', () => {
      it('should return all org units with member counts', async () => {
        const unit = await orgUnitService.create({ name: 'Team A' });
        const userId = await createUser();
        await orgUnitService.addMember(unit.id, userId);

        const all = await orgUnitService.findAll();
        expect(all.length).toBeGreaterThanOrEqual(1);

        const found = all.find((u) => u.id === unit.id);
        expect(found).toBeDefined();
        expect(found!.memberCount).toBe(1);
      });
    });

    describe('findOneOrFail', () => {
      it('should return org unit by ID', async () => {
        const unit = await orgUnitService.create({ name: 'Find Me' });
        const found = await orgUnitService.findOneOrFail(unit.id);
        expect(found.name).toBe('Find Me');
      });

      it('should throw NotFoundException for missing ID', async () => {
        await expect(orgUnitService.findOneOrFail(randomUUID()))
          .rejects.toThrow();
      });
    });

    describe('update', () => {
      it('should update org unit fields', async () => {
        const unit = await orgUnitService.create({ name: 'Old Name' });
        const updated = await orgUnitService.update(unit.id, { name: 'New Name', type: 'department' });

        expect(updated.name).toBe('New Name');
        expect(updated.type).toBe('department');
      });
    });

    describe('delete', () => {
      it('should delete org unit and cascade members', async () => {
        const unit = await orgUnitService.create({ name: 'Delete Me' });
        const userId = await createUser();
        await orgUnitService.addMember(unit.id, userId);

        await orgUnitService.delete(unit.id);

        await expect(orgUnitService.findOneOrFail(unit.id))
          .rejects.toThrow();
      });
    });

    describe('members', () => {
      it('should add a member to an org unit', async () => {
        const unit = await orgUnitService.create({ name: 'Team' });
        const userId = await createUser();

        await orgUnitService.addMember(unit.id, userId);

        const memberIds = await orgUnitService.getMemberIds(unit.id);
        expect(memberIds).toContain(userId);
      });

      it('should add member with position', async () => {
        const unit = await orgUnitService.create({ name: 'Team' });
        const userId = await createUser();
        const position = await positionService.create({ name: 'Lead' });

        await orgUnitService.addMember(unit.id, userId, position.id);

        const memberIds = await orgUnitService.getMemberIds(unit.id);
        expect(memberIds).toContain(userId);
      });

      it('should not duplicate members (upsert)', async () => {
        const unit = await orgUnitService.create({ name: 'Team' });
        const userId = await createUser();

        await orgUnitService.addMember(unit.id, userId);
        await orgUnitService.addMember(unit.id, userId); // Should not throw

        const memberIds = await orgUnitService.getMemberIds(unit.id);
        expect(memberIds).toHaveLength(1);
      });

      it('should update member position', async () => {
        const unit = await orgUnitService.create({ name: 'Team' });
        const userId = await createUser();
        const pos1 = await positionService.create({ name: 'Member' });
        const pos2 = await positionService.create({ name: 'Lead' });

        await orgUnitService.addMember(unit.id, userId, pos1.id);
        await orgUnitService.updateMemberPosition(unit.id, userId, pos2.id);

        // Member still exists with new position
        const memberIds = await orgUnitService.getMemberIds(unit.id);
        expect(memberIds).toContain(userId);
      });

      it('should remove member', async () => {
        const unit = await orgUnitService.create({ name: 'Team' });
        const userId = await createUser();

        await orgUnitService.addMember(unit.id, userId);
        await orgUnitService.removeMember(unit.id, userId);

        const memberIds = await orgUnitService.getMemberIds(unit.id);
        expect(memberIds).not.toContain(userId);
      });

      it('should return empty array for unit with no members', async () => {
        const unit = await orgUnitService.create({ name: 'Empty' });
        const memberIds = await orgUnitService.getMemberIds(unit.id);
        expect(memberIds).toEqual([]);
      });
    });

    describe('getVisibleOrgUnitIds', () => {
      it('should return unit and descendant IDs for a user', async () => {
        const parent = await orgUnitService.create({ name: 'Engineering' });
        const child = await orgUnitService.create({ name: 'Frontend', parentId: parent.id });
        const grandchild = await orgUnitService.create({ name: 'React', parentId: child.id });
        const userId = await createUser();

        await orgUnitService.addMember(parent.id, userId);

        const visible = await orgUnitService.getVisibleOrgUnitIds(userId);
        expect(visible).toContain(parent.id);
        expect(visible).toContain(child.id);
        expect(visible).toContain(grandchild.id);
      });

      it('should return empty when user is not in any org unit', async () => {
        const userId = await createUser();
        const visible = await orgUnitService.getVisibleOrgUnitIds(userId);
        expect(visible).toEqual([]);
      });
    });

    describe('getTeamMemberIds', () => {
      it('should return user + team members', async () => {
        const unit = await orgUnitService.create({ name: 'Team' });
        const user1 = await createUser('User1');
        const user2 = await createUser('User2');

        await orgUnitService.addMember(unit.id, user1);
        await orgUnitService.addMember(unit.id, user2);

        const team = await orgUnitService.getTeamMemberIds(user1);
        expect(team).toContain(user1);
        expect(team).toContain(user2);
      });

      it('should return only the user when not in any org unit', async () => {
        const userId = await createUser();
        const team = await orgUnitService.getTeamMemberIds(userId);
        expect(team).toEqual([userId]);
      });
    });
  });

  // ==================== OrgPositionService ====================

  describe('OrgPositionService', () => {
    describe('create', () => {
      it('should create a position', async () => {
        const pos = await positionService.create({ name: 'Director' });
        expect(pos.id).toBeDefined();
        expect(pos.name).toBe('Director');
      });
    });

    describe('findAll', () => {
      it('should return positions ordered by sortOrder', async () => {
        await positionService.create({ name: 'C', sortOrder: 2 });
        await positionService.create({ name: 'A', sortOrder: 0 });
        await positionService.create({ name: 'B', sortOrder: 1 });

        const all = await positionService.findAll();
        expect(all.map((p) => p.name)).toEqual(['A', 'B', 'C']);
      });
    });

    describe('update', () => {
      it('should update position name', async () => {
        const pos = await positionService.create({ name: 'Old' });
        const updated = await positionService.update(pos.id, { name: 'New' });
        expect(updated.name).toBe('New');
      });
    });

    describe('delete', () => {
      it('should delete position with no members', async () => {
        const pos = await positionService.create({ name: 'Delete Me' });
        await positionService.delete(pos.id);

        await expect(positionService.findOneOrFail(pos.id))
          .rejects.toThrow();
      });

      it('should throw ConflictException when position has assigned members', async () => {
        const pos = await positionService.create({ name: 'In Use' });
        const unit = await orgUnitService.create({ name: 'Team' });
        const userId = await createUser();
        await orgUnitService.addMember(unit.id, userId, pos.id);

        await expect(positionService.delete(pos.id))
          .rejects.toThrow('assigned');
      });
    });

    describe('seedDefaults', () => {
      it('should seed default positions when none exist', async () => {
        await positionService.seedDefaults();

        const all = await positionService.findAll();
        const names = all.map((p) => p.name);
        expect(names).toContain('Head');
        expect(names).toContain('Lead');
        expect(names).toContain('Member');
      });

      it('should not duplicate defaults when called again', async () => {
        await positionService.seedDefaults();
        await positionService.seedDefaults();

        const all = await positionService.findAll();
        const headCount = all.filter((p) => p.name === 'Head').length;
        expect(headCount).toBe(1);
      });
    });
  });
});
