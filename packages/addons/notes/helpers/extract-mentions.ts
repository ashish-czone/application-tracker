/**
 * Extracts unique user IDs from @mention nodes in TipTap HTML content.
 * TipTap renders mentions as: <span data-type="mention" data-id="user-uuid">@Name</span>
 */
export function extractMentionUserIds(html: string): string[] {
  if (!html) return [];

  const regex = /data-type="mention"\s+data-id="([^"]+)"|data-id="([^"]+)"\s+data-type="mention"/g;
  const ids = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const id = match[1] || match[2];
    if (id) ids.add(id);
  }

  return Array.from(ids);
}
