import { describe, it, expect } from 'vitest';
import { isMimeTypeAccepted, isFileSizeValid, getExtension, generateStorageKey } from '../validation';

describe('isMimeTypeAccepted', () => {
  it('accepts exact mime type match', () => {
    expect(isMimeTypeAccepted('image/png', ['image/png'])).toBe(true);
  });

  it('rejects non-matching mime type', () => {
    expect(isMimeTypeAccepted('application/pdf', ['image/png', 'image/jpeg'])).toBe(false);
  });

  it('accepts wildcard pattern (image/*)', () => {
    expect(isMimeTypeAccepted('image/jpeg', ['image/*'])).toBe(true);
    expect(isMimeTypeAccepted('image/png', ['image/*'])).toBe(true);
    expect(isMimeTypeAccepted('image/webp', ['image/*'])).toBe(true);
  });

  it('rejects non-matching wildcard', () => {
    expect(isMimeTypeAccepted('application/pdf', ['image/*'])).toBe(false);
  });

  it('accepts global wildcard', () => {
    expect(isMimeTypeAccepted('anything/here', ['*'])).toBe(true);
    expect(isMimeTypeAccepted('application/pdf', ['*/*'])).toBe(true);
  });

  it('accepts when list contains mixed patterns', () => {
    expect(isMimeTypeAccepted('application/pdf', ['image/*', 'application/pdf'])).toBe(true);
  });

  it('accepts everything when accept list is empty', () => {
    expect(isMimeTypeAccepted('application/pdf', [])).toBe(true);
  });
});

describe('isFileSizeValid', () => {
  it('accepts file within limit', () => {
    expect(isFileSizeValid(1000, 5000)).toBe(true);
  });

  it('accepts file at exact limit', () => {
    expect(isFileSizeValid(5000, 5000)).toBe(true);
  });

  it('rejects file over limit', () => {
    expect(isFileSizeValid(5001, 5000)).toBe(false);
  });

  it('rejects zero-size file', () => {
    expect(isFileSizeValid(0, 5000)).toBe(false);
  });

  it('rejects negative size', () => {
    expect(isFileSizeValid(-1, 5000)).toBe(false);
  });
});

describe('getExtension', () => {
  it('returns lowercase extension with dot', () => {
    expect(getExtension('photo.JPG')).toBe('.jpg');
  });

  it('handles no extension', () => {
    expect(getExtension('Makefile')).toBe('');
  });

  it('handles multiple dots', () => {
    expect(getExtension('archive.tar.gz')).toBe('.gz');
  });
});

describe('generateStorageKey', () => {
  it('generates key with correct structure', () => {
    const key = generateStorageKey('users', 'abc-123', 'avatar', 'photo.jpg');
    expect(key).toMatch(/^users\/abc-123\/avatar\/[0-9a-f-]+\.jpg$/);
  });

  it('preserves file extension', () => {
    const key = generateStorageKey('tasks', 'xyz', 'attachment', 'doc.pdf');
    expect(key).toMatch(/\.pdf$/);
  });

  it('generates unique keys', () => {
    const key1 = generateStorageKey('users', 'id', 'avatar', 'photo.jpg');
    const key2 = generateStorageKey('users', 'id', 'avatar', 'photo.jpg');
    expect(key1).not.toBe(key2);
  });

  it('handles files without extension', () => {
    const key = generateStorageKey('users', 'id', 'file', 'Makefile');
    expect(key).toMatch(/^users\/id\/file\/[0-9a-f-]+$/);
  });
});
