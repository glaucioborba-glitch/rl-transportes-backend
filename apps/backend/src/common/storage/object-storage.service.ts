import { randomUUID } from 'crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationCredentialsService } from '../../tenant/integration-credentials.service';
import { appendSignedMediaQuery, rewriteSignedUrlHost, verifyLocalMediaSignature } from './signed-media-url.util';
import { assertSafeStorageSegments, canonicalMediaKey, resolveSafeLocalPath } from './safe-local-path.util';

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
  private readonly envS3: S3Client | null = null;
  private readonly envBucket?: string;
  private tenantS3: S3Client | null = null;
  private tenantS3Fp = '';
  private readonly publicBase?: string;
  private readonly apiPublicBase: string;

  constructor(
    private readonly config: ConfigService,
    private readonly integrationCreds: IntegrationCredentialsService,
  ) {
    this.isProd = (config.get<string>('NODE_ENV') ?? 'development') === 'production';
    this.envBucket = config.get<string>('AWS_S3_BUCKET') ?? process.env.AWS_S3_BUCKET;
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
    if (this.envBucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.envS3 = new S3Client({
        region,
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      });
    }
  }

  onModuleInit(): void {
    if (this.isProd && !this.envBucket && !this.integrationCreds.peekS3().configured) {
      throw new Error(
        'AWS_S3_BUCKET obrigatório em produção. Configure bucket S3/R2 antes do go-live.',
      );
    }
    const runtime = this.runtimeS3();
    if (runtime) {
      this.logger.log(`Object storage: S3 bucket ${runtime.bucket}`);
    } else {
      this.logger.warn('Object storage: filesystem local (uploads/)');
    }
  }

  private runtimeS3(): { client: S3Client; bucket: string; publicBase?: string } | null {
    if (this.envS3 && this.envBucket) {
      return { client: this.envS3, bucket: this.envBucket, publicBase: this.publicBase };
    }
    const t = this.integrationCreds.peekS3();
    if (!t.configured || !t.bucket || !t.accessKeyId || !t.secretAccessKey) return null;
    const fp = `${t.bucket}|${t.endpoint ?? ''}|${t.region ?? ''}|${t.accessKeyId}`;
    if (!this.tenantS3 || this.tenantS3Fp !== fp) {
      this.tenantS3 = new S3Client({
        region: t.region || 'us-east-1',
        credentials: { accessKeyId: t.accessKeyId, secretAccessKey: t.secretAccessKey },
        ...(t.endpoint ? { endpoint: t.endpoint, forcePathStyle: true } : {}),
      });
      this.tenantS3Fp = fp;
    }
    return { client: this.tenantS3, bucket: t.bucket, publicBase: t.publicBaseUrl ?? this.publicBase };
  }

  usesS3(): boolean {
    return this.runtimeS3() !== null;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const runtime = this.runtimeS3();
    if (!runtime) {
      return { ok: true, message: 'Armazenamento local (uploads/) — dev' };
    }
    try {
      await runtime.client.send(new HeadBucketCommand({ Bucket: runtime.bucket }));
      const key = `_probe/${randomUUID()}.txt`;
      await this.putS3(key, Buffer.from('rl-probe'), 'text/plain');
      await this.deleteKeys([key]);
      return { ok: true, message: `Bucket S3 ${runtime.bucket} — read/write OK` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  /** URL de leitura: S3/MinIO pré-assinado ou HMAC local. Nunca URL pública sem query. */
  async resolveReadUrl(key: string, expiresSec = 3600): Promise<string> {
    const k = key.replace(/^\/+/, '');
    const runtime = this.runtimeS3();
    if (runtime) {
      const signed = await getSignedUrl(
        runtime.client,
        new GetObjectCommand({ Bucket: runtime.bucket, Key: k }),
        { expiresIn: expiresSec },
      );
      return rewriteSignedUrlHost(signed, runtime.publicBase);
    }
    const rel = this.toLocalRelativeKey(k);
    const unsigned = `${this.apiPublicBase.replace(/\/$/, '')}/v2/gate/vistoria/media/${rel
      .split('/')
      .map((p) => encodeURIComponent(p))
      .join('/')}`;
    return appendSignedMediaQuery(unsigned, rel, this.mediaSigningSecret());
  }

  private async putS3(key: string, body: Buffer, contentType: string): Promise<ObjectStoragePutResult> {
    const runtime = this.runtimeS3();
    if (!runtime) throw new Error('S3 não configurado');
    await runtime.client.send(
      new PutObjectCommand({
        Bucket: runtime.bucket,
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
    const relParts = params.parts;
    assertSafeStorageSegments(params.namespace.split(/[\\/]/).filter(Boolean));
    assertSafeStorageSegments(relParts);
    if (relParts.some((p) => /[\\/]/.test(p))) {
      throw new Error('Object storage path inválido');
    }
    const key = `${params.namespace}/${relParts.join('/')}/${randomUUID()}_${safe}`;

    if (this.usesS3()) {
      return this.putS3(key, params.buffer, params.mimeType);
    }
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const base = path.resolve(uploadsRoot, params.namespace, ...relParts);
    const relToUploads = path.relative(uploadsRoot, base);
    if (!relToUploads || relToUploads.startsWith('..') || path.isAbsolute(relToUploads)) {
      throw new Error('Object storage path inválido');
    }
    fs.mkdirSync(base, { recursive: true });
    const file = `${randomUUID()}_${safe}`;
    fs.writeFileSync(path.join(base, file), params.buffer);
    const storageKey = `${relParts.join('/')}/${file}`.replace(/\\/g, '/');
    const servePath = `/v2/gate/vistoria/media/${storageKey
      .split('/')
      .map((p) => encodeURIComponent(p))
      .join('/')}`;
    const unsigned = `${this.apiPublicBase.replace(/\/$/, '')}${params.localServePath ?? servePath}`;
    const url = appendSignedMediaQuery(unsigned, storageKey, this.mediaSigningSecret());
    this.logger.warn(`Object stored local: ${storageKey}`);
    return { url, storageKey: `${params.namespace}/${storageKey}` };
  }

  readLocal(namespace: string, storageKey: string): { buffer: Buffer; mimeType: string } {
    const full = resolveSafeLocalPath(namespace, storageKey);
    const mimeType = full.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return { buffer: fs.readFileSync(full), mimeType };
  }

  verifyLocalMediaAccess(storageKey: string, exp?: string, sig?: string): boolean {
    const rel = this.toLocalRelativeKey(storageKey);
    return verifyLocalMediaSignature(rel, exp, sig, this.mediaSigningSecret());
  }

  private mediaSigningSecret(): string {
    return (
      this.config.get<string>('STORAGE_SIGNING_SECRET') ??
      this.config.get<string>('secrets.jwtSecret') ??
      this.config.get<string>('JWT_SECRET') ??
      process.env.JWT_SECRET ??
      ''
    );
  }

  private toLocalRelativeKey(storageKey: string): string {
    const k = canonicalMediaKey(storageKey);
    for (const prefix of ['vistorias/', 'logistica/vistorias/']) {
      if (k.startsWith(prefix)) return k.slice(prefix.length);
    }
    return k;
  }

  async getBuffer(storageKey: string): Promise<{ buffer: Buffer; mimeType?: string }> {
    const k = canonicalMediaKey(storageKey);
    const runtime = this.runtimeS3();
    if (runtime) {
      const out = await runtime.client.send(new GetObjectCommand({ Bucket: runtime.bucket, Key: k }));
      const bytes = await out.Body!.transformToByteArray();
      return { buffer: Buffer.from(bytes), mimeType: out.ContentType };
    }
    const slash = k.indexOf('/');
    const namespace = slash > 0 ? k.slice(0, slash) : 'objects';
    const rel = slash > 0 ? k.slice(slash + 1) : k;
    const full = resolveSafeLocalPath(namespace, rel);
    const lower = k.toLowerCase();
    const mimeType = lower.endsWith('.pdf')
      ? 'application/pdf'
      : lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';
    return { buffer: fs.readFileSync(full), mimeType };
  }

  async deleteMany(keys: string[]): Promise<void> {
    await this.deleteKeys(keys);
  }

  async deleteKeys(storageKeys: string[], localNamespace = 'vistorias'): Promise<void> {
    for (const key of storageKeys) {
      if (!key || key.includes('..')) continue;
      const runtime = this.runtimeS3();
      if (runtime) {
        try {
          await runtime.client.send(new DeleteObjectCommand({ Bucket: runtime.bucket, Key: key }));
        } catch (e) {
          this.logger.warn(`Falha ao remover S3 ${key}: ${(e as Error).message}`);
        }
        continue;
      }
      const rel = key.includes('/') ? key.replace(/^[^/]+\//, '') : key;
      try {
        fs.unlinkSync(resolveSafeLocalPath(localNamespace, rel));
      } catch {
        /* ignore missing / path inválido */
      }
    }
  }
}
