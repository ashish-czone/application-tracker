export interface MediaProvider {
  readonly name: string;
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  move(fromKey: string, toKey: string): Promise<void>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  getPublicUrl(key: string): string;
}
