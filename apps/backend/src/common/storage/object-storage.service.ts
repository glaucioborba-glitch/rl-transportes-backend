import { randomUUID } from 'crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ObjectStoragePutResult {
  url: string;
  storageKey: string;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file.bin';
}

/** Abstração S3/R2 (prod) vs filesystem local (dev). */
@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);
  private readonly isProd: boolean;
  private s3: S3Client | null = null;
  private readonly bucket?: string;
  private readonly publicBase?: string;
  private readonly apiPublicBase: string;

  constructor(private readonly config: ConfigService) {
    this.isProd = (config.get<string>('NODE_ENV') ?? 'development') === 'production';
    this.bucket = config.get<string>('AWS_S3_BUCKET') ?? process.env.AWS_S3_BUCKET;
    this.publicBase =
      config.get<string>('STORAGE_PUBLIC_BASE_URL') ??
      process.env.STORAGE_PUBLIC_BASE_URL;
    this.apiPublicBase =
      config.get<string>('API_PUBLIC_BASE_URL') ??
      process.env.API_PUBLIC_BASE_URL ??
      `http://localhost:${process.env.API_PORT ?? '3001'}`;
    const region = config.get<string>('AWS_REGION') ?? process.env.AWS_REGION ?? 'us-east-1';
    const endpoint =
      config.get<string>('STORAGE_ENDPOINT') ??
      process.env.STORAGE_ENDPOINT ??
      process.env.S3_ENDPOINT ??
      process.env.R2_ENDPOINT;
    if (this.bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3 = new S3Client({
        region,
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      });
    }
  }

  onModuleInit(): void {
    if (this.isProd && !this.bucket) {
      throw new Error(
        'AWS_S3_BUCKET obrigatório em produção. Configure bucket S3/R2 antes do go-live.',
      );
    }
    if (this.usesS3()) {
      this.logger.log(`Object storage: S3 bucket ${this.bucket}`);
    } else {
      this.logger.warn('Object storage: filesystem local (uploads/)');
    }
  }

  usesS3(): boolean {
    return Boolean(this.s3 && this.bucket);
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.usesS3()) {
      return { ok: true, message: 'Armazenamento local (uploads/) — dev' };
    }
    try {
      await this.s3!.send(new HeadBucketCommand({ Bucket: this.bucket! }));
      const key = `_probe/${randomUUID()}.txt`;
      await this.putS3(key, Buffer.from('rl-probe'), 'text/plain');
      await this.deleteKeys([key]);
      return { ok: true, message: `Bucket S3 ${this.bucket} — read/write OK` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  /** URL de leitura: CDN pública ou presigned (sem ACL public-read). */
  async resolveReadUrl(key: string, expiresSec = 3600): Promise<string> {
    const k = key.replace(/^\/+/, '');
    if (this.publicBase) {
      return `${this.publicBase.replace(/\/$/, '')}/${k}`;
    }
    if (this.usesS3()) {
      return getSignedUrl(
        this.s3!,
        new GetObjectCommand({ Bucket: this.bucket!, Key: k }),
        { expiresIn: expiresSec },
      );
    }
    const rel = k.includes('/') ? k.replace(/^[^/]+\//, '') : k;
    return `${this.apiPublicBase.replace(/\/$/, '')}/v2/gate/vistoria/media/${encodeURIComponent(rel)}`;
  }

  private async putS3(key: string, body: Buffer, contentType: string): Promise<ObjectStoragePutResult> {
    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const url = await this.resolveReadUrl(key);
    this.logger.log(`Object stored S3 ${key}`);
    return { url, storageKey: key };
  }

  /** Upload com chave explícita (anexos, gate photos). */
  async upload(params: {
    key: string;
    body: Buffer;
    contentType: string;
    localServePath?: string;
  }): Promise<ObjectStoragePutResult> {
    const key = params.key.replace(/^\/+/, '');
    if (this.usesS3()) {
      return this.putS3(key, params.body, params.contentType);
    }

    const parts = key.split('/');
    const filename = parts.pop() ?? randomUUID();
    const namespace = parts.shift() ?? 'objects';
    const relParts = parts;
    return this.putBuffer({
      namespace,
      parts: relParts,
      filename,
      buffer: params.body,
      mimeType: params.contentType,
      localServePath: params.localServePath,
    });
  }

  async putBuffer(params: {
    namespace: string;
    parts: string[];
    filename: string;
    buffer: Buffer;
    mimeType: string;
    localServePath?: string;
  }): Promise<ObjectStoragePutResult> {
    const safe = sanitizeFilename(params.filename);
    const key = `${params.namespace}/${params.parts.join('/')}/${randomUUID()}_${safe}`;

    if (this.usesS3()) {
      return this.putS3(key, params.buffer, params.mimeType);
    }

    const relParts = params.parts;
    const base = path.join(process.cwd(), 'uploads', params.namespace, ...relParts);
    fs.mkdirSync(base, { recursive: true });
    const file = `${randomUUID()}_${safe}`;
    fs.writeFileSync(path.join(base, file), params.buffer);
    const storageKey = `${relParts.join('/')}/${file}`.replace(/\\/g, '/');
    const serve =
      params.localServePath ??
      `/v2/gate/vistoria/media/${encodeURIComponent(storageKey)}`;
    const url = `${this.apiPublicBase.replace(/\/$/, '')}${serve}`;
    this.logger.warn(`Object stored local: ${storageKey}`);
    return { url, storageKey: `${params.namespace}/${storageKey}` };
  }

  readLocal(namespace: string, storageKey: string): { buffer: Buffer; mimeType: string } {
    const full = path.join(process.cwd(), 'uploads', namespace, storageKey);
    if (!fs.existsSync(full)) throw new NotFoundException('Arquivo não encontrado');
    const mimeType = full.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return { buffer: fs.readFileSync(full), mimeType };
  }

  async deleteMany(keys: string[]): Promise<void> {
    await this.deleteKeys(keys);
  }

  async deleteKeys(storageKeys: string[], localNamespace = 'vistorias'): Promise<void> {
    for (const key of storageKeys) {
      if (!key || key.includes('..')) continue;
      if (this.usesS3()) {
        try {
          await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket!, Key: key }));
        } catch (e) {
          this.logger.warn(`Falha ao remover S3 ${key}: ${(e as Error).message}`);
        }
        continue;
      }
      const rel = key.includes('/') ? key.replace(/^[^/]+\//, '') : key;
      const full = path.join(process.cwd(), 'uploads', localNamespace, rel);
      try {
        fs.unlinkSync(full);
      } catch {
        /* ignore */
      }
    }
  }
}
