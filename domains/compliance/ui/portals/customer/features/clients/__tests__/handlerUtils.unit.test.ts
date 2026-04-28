import { describe, it, expect } from 'vitest';
import {
  formatUserDisplayName,
  formatUserInitials,
  formatUserPositionLabel,
} from '../handlerUtils';

describe('formatUserDisplayName', () => {
  it('joins first and last when both present', () => {
    expect(
      formatUserDisplayName({ firstName: 'Priya', lastName: 'Shankar', email: 'p@x.com' }),
    ).toBe('Priya Shankar');
  });

  it('uses whichever name part is available', () => {
    expect(formatUserDisplayName({ firstName: 'Priya', lastName: '', email: 'p@x.com' })).toBe(
      'Priya',
    );
    expect(formatUserDisplayName({ firstName: '', lastName: 'Shankar', email: 'p@x.com' })).toBe(
      'Shankar',
    );
  });

  it('falls back to the email local part when no name is set', () => {
    expect(formatUserDisplayName({ firstName: '', lastName: '', email: 'priya@x.com' })).toBe(
      'priya',
    );
  });

  it('returns "Unknown user" when both name and email are empty', () => {
    expect(formatUserDisplayName({ firstName: '', lastName: '', email: '' })).toBe('Unknown user');
  });
});

describe('formatUserInitials', () => {
  it('uses first letter of first + last when both present', () => {
    expect(
      formatUserInitials({ firstName: 'Priya', lastName: 'Shankar', email: '' }),
    ).toBe('PS');
  });

  it('falls back to two letters of whichever piece is present', () => {
    expect(formatUserInitials({ firstName: 'Arjun', lastName: '', email: '' })).toBe('AR');
    expect(formatUserInitials({ firstName: '', lastName: '', email: 'kavita@x.com' })).toBe('KA');
  });

  it('returns em-dash when nothing is available', () => {
    expect(formatUserInitials({ firstName: '', lastName: '', email: '' })).toBe('—');
  });
});

describe('formatUserPositionLabel', () => {
  it('combines position and unit name when both present', () => {
    expect(
      formatUserPositionLabel({
        positions: [
          { unitId: 'u1', unitName: 'GST Desk', positionId: 'p1', positionName: 'Senior' },
        ],
      }),
    ).toBe('Senior · GST Desk');
  });

  it('returns whichever piece is set when only one is available', () => {
    expect(
      formatUserPositionLabel({
        positions: [{ unitId: 'u1', unitName: 'GST Desk', positionId: null, positionName: null }],
      }),
    ).toBe('GST Desk');
    expect(
      formatUserPositionLabel({
        positions: [{ unitId: 'u1', unitName: '', positionId: 'p1', positionName: 'Manager' }],
      }),
    ).toBe('Manager');
  });

  it('returns empty string when there are no positions', () => {
    expect(formatUserPositionLabel({ positions: [] })).toBe('');
  });
});
