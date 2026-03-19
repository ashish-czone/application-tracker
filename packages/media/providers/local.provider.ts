import { mkdir, writeFile, unlink } from 'fs/promises';
import { dirname, join } from 'path';
import type { MediaProvider } from './media-provider.interface';

export class LocalMediaProvider implements MediaProvider {
  readonly name = 'local';

  constructor(
    private readonly basePath: string,
    private readonly baseUrl: string,
  ) {}

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const filePath = join(this.basePath, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.basePath, key);
    try {
      await unlink(filePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async getSignedUrl(key: string, _expiresIn?: number): Promise<string> {
    return this.getPublicUrl(key);
  }

  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}
