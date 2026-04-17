import { describe, it, expect, expectTypeOf } from 'vitest';
import { TASKS_FIELDS, TASKS_METADATA, tasksRoutes } from '../index';
import type { Task, TaskCreateInput, TaskUpdateInput, TaskStatus, TaskPriority } from '../index';

describe('tasksRoutes', () => {
  it('uses /tasks as the base path', () => {
    expect(tasksRoutes.base).toBe('/tasks');
    expect(tasksRoutes.transition('abc')).toBe('/tasks/abc/transition');
  });
});

describe('TASKS_METADATA', () => {
  it('declares the slug and soft-delete behavior the api relies on', () => {
    expect(TASKS_METADATA.slug).toBe('tasks');
    expect(TASKS_METADATA.softDelete).toBe(true);
    expect(TASKS_METADATA.hasTags).toEqual({ groupSlug: 'task-tags' });
  });
});

describe('TASKS_FIELDS', () => {
  it('declares every field used by the entity', () => {
    expect(Object.keys(TASKS_FIELDS)).toEqual([
      'title',
      'description',
      'status',
      'priority',
      'assigneeId',
      'assigneeTeamId',
      'dueDate',
      'createdBy',
      'relatedEntityType',
      'relatedEntityId',
      'externalKey',
    ]);
  });

  it('keeps the status workflow states in sync with TaskStatus', () => {
    const stateNames = TASKS_FIELDS.status.workflow.states.map((s) => s.name);
    expect(stateNames).toEqual(['pending', 'in_progress', 'review', 'completed', 'cancelled']);
  });

  it('keeps the priority options in sync with TaskPriority', () => {
    const values = TASKS_FIELDS.priority.options.map((o) => o.value);
    expect(values).toEqual(['low', 'medium', 'high', 'urgent']);
  });
});

describe('Task row type', () => {
  it('narrows status and priority to literal unions and makes them non-null', () => {
    expectTypeOf<Task['status']>().toEqualTypeOf<TaskStatus>();
    expectTypeOf<Task['priority']>().toEqualTypeOf<TaskPriority>();
  });

  it('carries base entity columns', () => {
    expectTypeOf<Task['id']>().toEqualTypeOf<string>();
    expectTypeOf<Task['createdAt']>().toEqualTypeOf<string>();
    expectTypeOf<Task['deletedAt']>().toEqualTypeOf<string | null>();
  });

  it('makes required fields non-null and optional fields nullable', () => {
    expectTypeOf<Task['title']>().toEqualTypeOf<string>();
    expectTypeOf<Task['description']>().toEqualTypeOf<string | null>();
    expectTypeOf<Task['assigneeId']>().toEqualTypeOf<string | null>();
  });
});

describe('TaskCreateInput', () => {
  it('requires title and allows priority as a narrowed union', () => {
    const minimal: TaskCreateInput = { title: 'Do the thing' };
    expect(minimal.title).toBe('Do the thing');

    const full: TaskCreateInput = {
      title: 'Do it',
      description: 'details',
      priority: 'high',
      assigneeId: 'user-1',
      dueDate: '2026-05-01',
    };
    expectTypeOf(full.priority).toEqualTypeOf<TaskPriority | null | undefined>();
  });

  it('excludes system and readonly fields', () => {
    expectTypeOf<TaskCreateInput>().not.toHaveProperty('status');
    expectTypeOf<TaskCreateInput>().not.toHaveProperty('createdBy');
    expectTypeOf<TaskCreateInput>().not.toHaveProperty('relatedEntityType');
    expectTypeOf<TaskCreateInput>().not.toHaveProperty('externalKey');
  });
});

describe('TaskUpdateInput', () => {
  it('is a partial of the create input', () => {
    const empty: TaskUpdateInput = {};
    expect(empty).toEqual({});
    expectTypeOf<TaskUpdateInput>().toEqualTypeOf<Partial<TaskCreateInput>>();
  });
});
