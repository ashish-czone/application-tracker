import { describe, it, expect } from 'vitest';
import { extractMentionUserIds } from '../extract-mentions';

describe('extractMentionUserIds', () => {
  it('returns empty array for empty content', () => {
    expect(extractMentionUserIds('')).toEqual([]);
  });

  it('returns empty array for null/undefined content', () => {
    expect(extractMentionUserIds(null as any)).toEqual([]);
    expect(extractMentionUserIds(undefined as any)).toEqual([]);
  });

  it('returns empty array for content without mentions', () => {
    expect(extractMentionUserIds('<p>Hello world</p>')).toEqual([]);
  });

  it('extracts a single mention', () => {
    const html = '<p>Hey <span data-type="mention" data-id="user-123">@John</span> check this</p>';
    expect(extractMentionUserIds(html)).toEqual(['user-123']);
  });

  it('extracts multiple mentions', () => {
    const html = '<p><span data-type="mention" data-id="user-1">@Alice</span> and <span data-type="mention" data-id="user-2">@Bob</span></p>';
    expect(extractMentionUserIds(html)).toEqual(['user-1', 'user-2']);
  });

  it('deduplicates mentions of the same user', () => {
    const html = '<p><span data-type="mention" data-id="user-1">@Alice</span> and again <span data-type="mention" data-id="user-1">@Alice</span></p>';
    expect(extractMentionUserIds(html)).toEqual(['user-1']);
  });

  it('handles data-id before data-type attribute order', () => {
    const html = '<span data-id="user-456" data-type="mention">@Jane</span>';
    expect(extractMentionUserIds(html)).toEqual(['user-456']);
  });

  it('handles UUID-style IDs', () => {
    const html = '<span data-type="mention" data-id="550e8400-e29b-41d4-a716-446655440000">@User</span>';
    expect(extractMentionUserIds(html)).toEqual(['550e8400-e29b-41d4-a716-446655440000']);
  });

  it('ignores data-id without data-type="mention"', () => {
    const html = '<span data-type="link" data-id="user-123">@NotMention</span>';
    expect(extractMentionUserIds(html)).toEqual([]);
  });
});
