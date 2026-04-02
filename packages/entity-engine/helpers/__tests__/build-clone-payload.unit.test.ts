import { describe, it, expect } from 'vitest';
import { buildClonePayload } from '../build-clone-payload';
import type { FieldDefinition } from '../../types';

/** Helper to build a minimal field definition for tests */
function field(overrides: Partial<FieldDefinition> & { fieldKey: string; fieldType: FieldDefinition['fieldType'] }): FieldDefinition {
  return {
    id: 'test-id',
    entityType: 'test',
    label: overrides.fieldKey,
    uiType: null,
    isRequired: false,
    isSystem: false,
    isCustom: false,
    isUnique: false,
    isQuickCreate: false,
    isReadonly: false,
    maxLength: null,
    defaultValue: null,
    columnName: null,
    lookupEntity: null,
    lookupLabelField: null,
    lookupSearchFields: null,
    tagGroupSlug: null,
    categoryGroupSlug: null,
    fileAccept: null,
    fileMaxSize: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('buildClonePayload', () => {
  it('should copy standard text fields', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'description', fieldType: 'textarea', columnName: 'description' }),
    ];
    const source = { title: 'My Task', description: 'Some details' };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.title).toBe('Copy of My Task');
    expect(result.description).toBe('Some details');
  });

  it('should prefix "Copy of" only to the primary name field', () => {
    const defs = [
      field({ fieldKey: 'firstName', fieldType: 'text', columnName: 'first_name' }),
      field({ fieldKey: 'lastName', fieldType: 'text', columnName: 'last_name' }),
    ];
    const source = { firstName: 'John', lastName: 'Doe' };

    const result = buildClonePayload(source, defs, 'firstName');

    expect(result.firstName).toBe('Copy of John');
    expect(result.lastName).toBe('Doe');
  });

  it('should skip auto_number fields', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'taskNumber', fieldType: 'auto_number', columnName: 'task_number' }),
    ];
    const source = { title: 'My Task', taskNumber: 'TASK-001' };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.title).toBe('Copy of My Task');
    expect(result.taskNumber).toBeUndefined();
  });

  it('should skip workflow fields', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'status', fieldType: 'workflow', columnName: 'status' }),
    ];
    const source = { title: 'My Task', status: 'open' };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.title).toBe('Copy of My Task');
    expect(result.status).toBeUndefined();
  });

  it('should skip readonly fields', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'createdBy', fieldType: 'user', columnName: 'created_by', isReadonly: true }),
    ];
    const source = { title: 'My Task', createdBy: 'user-123' };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.title).toBe('Copy of My Task');
    expect(result.createdBy).toBeUndefined();
  });

  it('should transform tags from hydrated [{id,name,color}] to string[]', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'skills', fieldType: 'tags', tagGroupSlug: 'skills' }),
    ];
    const source = {
      title: 'My Task',
      skills: [
        { id: 'tag-1', name: 'JavaScript', color: 'blue' },
        { id: 'tag-2', name: 'TypeScript', color: 'green' },
      ],
    };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.skills).toEqual(['tag-1', 'tag-2']);
  });

  it('should transform multi_user from hydrated [{id,label}] to string[]', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'assignees', fieldType: 'multi_user' }),
    ];
    const source = {
      title: 'My Task',
      assignees: [
        { id: 'user-1', label: 'Alice' },
        { id: 'user-2', label: 'Bob' },
      ],
    };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.assignees).toEqual(['user-1', 'user-2']);
  });

  it('should transform multi_lookup from hydrated [{id,label}] to string[]', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'relatedJobs', fieldType: 'multi_lookup', lookupEntity: 'job-openings' }),
    ];
    const source = {
      title: 'My Task',
      relatedJobs: [
        { id: 'job-1', label: 'Frontend Dev' },
        { id: 'job-2', label: 'Backend Dev' },
      ],
    };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.relatedJobs).toEqual(['job-1', 'job-2']);
  });

  it('should copy lookup fields as-is (single UUID)', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'clientId', fieldType: 'lookup', columnName: 'client_id', lookupEntity: 'clients' }),
    ];
    const source = { title: 'My Task', clientId: 'client-uuid-123' };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.clientId).toBe('client-uuid-123');
  });

  it('should copy file fields as-is (JSON reference)', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'resume', fieldType: 'file' }),
    ];
    const fileRef = { key: 'uploads/resume.pdf', name: 'resume.pdf', size: 12345, mimeType: 'application/pdf' };
    const source = { title: 'My Task', resume: fileRef };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.resume).toEqual(fileRef);
  });

  it('should copy category fields as-is (UUID)', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'department', fieldType: 'category', columnName: 'department', categoryGroupSlug: 'departments' }),
    ];
    const source = { title: 'My Task', department: 'cat-uuid-456' };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.department).toBe('cat-uuid-456');
  });

  it('should skip null and undefined values', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'notes', fieldType: 'textarea', columnName: 'notes' }),
      field({ fieldKey: 'priority', fieldType: 'picklist', columnName: 'priority' }),
    ];
    const source = { title: 'My Task', notes: null, priority: undefined };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.title).toBe('Copy of My Task');
    expect(result.notes).toBeUndefined();
    expect(result.priority).toBeUndefined();
  });

  it('should copy picklist and boolean fields as-is', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'priority', fieldType: 'picklist', columnName: 'priority' }),
      field({ fieldKey: 'isUrgent', fieldType: 'boolean', columnName: 'is_urgent' }),
    ];
    const source = { title: 'My Task', priority: 'high', isUrgent: true };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.priority).toBe('high');
    expect(result.isUrgent).toBe(true);
  });

  it('should handle empty relational arrays', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'tags', fieldType: 'tags' }),
      field({ fieldKey: 'assignees', fieldType: 'multi_user' }),
    ];
    const source = { title: 'My Task', tags: [], assignees: [] };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.tags).toEqual([]);
    expect(result.assignees).toEqual([]);
  });

  it('should copy number, currency, and date fields as-is', () => {
    const defs = [
      field({ fieldKey: 'title', fieldType: 'text', columnName: 'title' }),
      field({ fieldKey: 'salary', fieldType: 'currency', columnName: 'salary' }),
      field({ fieldKey: 'startDate', fieldType: 'date', columnName: 'start_date' }),
      field({ fieldKey: 'quantity', fieldType: 'number', columnName: 'quantity' }),
    ];
    const source = { title: 'My Task', salary: 50000, startDate: '2026-01-15', quantity: 5 };

    const result = buildClonePayload(source, defs, 'title');

    expect(result.salary).toBe(50000);
    expect(result.startDate).toBe('2026-01-15');
    expect(result.quantity).toBe(5);
  });
});
