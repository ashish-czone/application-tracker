import type { MediaProvider } from './media-provider.interface';
import type { MediaModuleConfig } from '../types';

export class S3MediaProvider implements MediaProvider {
  readonly name = 's3';
  private client: any;
  private bucket: string;
  private baseUrl: string;

  constructor(private readonly config: MediaModuleConfig) {
    this.bucket = config.s3Bucket!;

    if (config.s3Endpoint) {
      const endpoint = config.s3Endpoint.replace(/\/$/, '');
      this.baseUrl = config.s3ForcePathStyle
        ? `${endpoint}/${this.bucket}`
        : `${endpoint}`;
    } else {
      this.baseUrl = `https://${this.bucket}.s3.${config.s3Region ?? 'us-east-1'}.amazonaws.com`;
    }
  }

  private async getClient() {
    if (this.client) return this.client;

    try {
      const { S3Client } = await import('@aws-sdk/client-s3');
      this.client = new S3Client({
        region: this.config.s3Region ?? 'us-east-1',
        credentials: this.config.s3AccessKeyId
          ? {
              accessKeyId: this.config.s3AccessKeyId,
              secretAccessKey: this.config.s3SecretAccessKey!,
            }
          : undefined,
        endpoint: this.config.s3Endpoint || undefined,
        forcePathStyle: this.config.s3ForcePathStyle ?? false,
      });
      return this.client;
    } catch {
      throw new Error(
        'S3 provider requires @aws-sdk/client-s3. Install it: pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner',
      );
    }
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    const client = await this.getClient();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
  }

  async move(fromKey: string, toKey: string): Promise<void> {
    const client = await this.getClient();
    const { CopyObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${fromKey}`,
        Key: toKey,
      }),
    );
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fromKey,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    const client = await this.getClient();
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const client = await this.getClient();
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    return getSignedUrl(client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn,
    });
  }

  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}
