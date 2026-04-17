import { describe, it, expect, expectTypeOf } from 'vitest';
import { buildEntityRoutes } from '../routes';
import type {
  FieldMap,
  EntityRow,
  EntityCreateInput,
  EntityUpdateInput,
  BaseEntityRow,
  SoftDeletableRow,
} from '../index';

const fields = {
  title: { type: 'text', label: 'Title', required: true },
  description: { type: 'textarea', label: 'Description' },
  count: { type: 'number', label: 'Count', required: true },
  done: { type: 'boolean', label: 'Done' },
  dueDate: { type: 'date', label: 'Due date' },
  assigneeId: { type: 'user', label: 'Assignee' },
  priority: {
    type: 'picklist',
    label: 'Priority',
    options: [
      { label: 'Low', value: 'low' },
      { label: 'High', value: 'high' },
    ],
  },
  tags: { type: 'tags', label: 'Tags' },
  createdBy: { type: 'user', label: 'Created by', system: true, readonly: true },
  status: {
    type: 'workflow',
    label: 'Status',
    system: true,
    workflow: {
      slug: 'test-status',
      initialState: 'open',
      states: [
        { name: 'open', label: 'Open' },
        { name: 'closed', label: 'Closed' },
      ],
      transitions: [],
    },
  },
  subtasks: { type: 'hasMany', label: 'Subtasks', entity: 'tasks' },
} satisfies FieldMap;

type Row = EntityRow<typeof fields>;
type CreateIn = EntityCreateInput<typeof fields>;
type UpdateIn = EntityUpdateInput<typeof fields>;

describe('EntityRow', () => {
  it('maps each field type to the expected value type', () => {
    expectTypeOf<Row['title']>().toEqualTypeOf<string>();
    expectTypeOf<Row['description']>().toEqualTypeOf<string | null>();
    expectTypeOf<Row['count']>().toEqualTypeOf<number>();
    expectTypeOf<Row['done']>().toEqualTypeOf<boolean | null>();
    expectTypeOf<Row['dueDate']>().toEqualTypeOf<string | null>();
    expectTypeOf<Row['assigneeId']>().toEqualTypeOf<string | null>();
    expectTypeOf<Row['priority']>().toEqualTypeOf<string | null>();
    expectTypeOf<Row['tags']>().toEqualTypeOf<string[] | null>();
    expectTypeOf<Row['status']>().toEqualTypeOf<string | null>();
    expectTypeOf<Row['createdBy']>().toEqualTypeOf<string | null>();
  });

  it('omits hasMany / manyToMany fields', () => {
    expectTypeOf<Row>().not.toHaveProperty('subtasks');
  });
});

describe('EntityCreateInput', () => {
  it('requires `required` writable fields, keeps others optional', () => {
    expectTypeOf<CreateIn['title']>().toEqualTypeOf<string>();
    expectTypeOf<CreateIn['count']>().toEqualTypeOf<number>();
  });

  it('excludes system and readonly fields', () => {
    expectTypeOf<CreateIn>().not.toHaveProperty('createdBy');
    expectTypeOf<CreateIn>().not.toHaveProperty('status');
  });

  it('excludes relation fields', () => {
    expectTypeOf<CreateIn>().not.toHaveProperty('subtasks');
  });
});

describe('EntityUpdateInput', () => {
  it('makes every writable field optional', () => {
    const empty: UpdateIn = {};
    expect(empty).toEqual({});

    const partial: UpdateIn = { title: 'new' };
    expect(partial.title).toBe('new');
  });
});

describe('BaseEntityRow / SoftDeletableRow', () => {
  it('compose via intersection to form the full row type', () => {
    type FullRow = Row & BaseEntityRow & SoftDeletableRow;
    expectTypeOf<FullRow['id']>().toEqualTypeOf<string>();
    expectTypeOf<FullRow['createdAt']>().toEqualTypeOf<string>();
    expectTypeOf<FullRow['deletedAt']>().toEqualTypeOf<string | null>();
  });
});

describe('buildEntityRoutes', () => {
  it('builds the standard REST surface from a slug', () => {
    const routes = buildEntityRoutes('tasks');
    expect(routes.base).toBe('/tasks');
    expect(routes.list).toBe('/tasks');
    expect(routes.create).toBe('/tasks');
    expect(routes.byId('abc')).toBe('/tasks/abc');
    expect(routes.update('abc')).toBe('/tasks/abc');
    expect(routes.delete('abc')).toBe('/tasks/abc');
    expect(routes.transition('abc')).toBe('/tasks/abc/transition');
    expect(routes.clone('abc')).toBe('/tasks/abc/clone');
    expect(routes.restore('abc')).toBe('/tasks/abc/restore');
    expect(routes.reparent('abc')).toBe('/tasks/abc/reparent');
    expect(routes.ancestors('abc')).toBe('/tasks/abc/ancestors');
    expect(routes.descendants('abc')).toBe('/tasks/abc/descendants');
    expect(routes.listLayout).toBe('/tasks/layout/list');
  });
});
