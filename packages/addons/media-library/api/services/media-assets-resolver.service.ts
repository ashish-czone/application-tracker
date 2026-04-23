import { Injectable } from '@nestjs/common';
import { DatabaseService, inArray, isNull, and } from '@packages/database';
import { mediaAssets } from '../schema/media-assets';

@Injectable()
export class MediaAssetsResolverService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Look up public URLs for a batch of media-asset IDs. Soft-deleted
   * rows are skipped — callers treat a missing entry the same way as
   * an unset reference.
   */
  async resolveUrls(ids: readonly string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (ids.length === 0) return out;

    const rows = await this.db.db
      .select({ id: mediaAssets.id, url: mediaAssets.url })
      .from(mediaAssets)
      .where(and(inArray(mediaAssets.id, [...ids]), isNull(mediaAssets.deletedAt)));

    for (const row of rows) {
      out.set(row.id, row.url);
    }
    return out;
  }
}
