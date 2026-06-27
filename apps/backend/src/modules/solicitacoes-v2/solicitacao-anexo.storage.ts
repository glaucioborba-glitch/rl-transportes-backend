import { randomUUID } from 'crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PREFIX = 'logistica/solicitacoes';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) || 'arquivo';
}

@Injectable()
export class SolicitacaoAnexoStorageService {
  private readonly logger = new Logger(SolicitacaoAnexoStorageService.name);
  private s3: S3Client | null = null;
  private readonly bucket: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') ?? process.env.AWS_S3_BUCKET;
    const region = this.config.get<string>('AWS_REGION') ?? process.env.AWS_REGION ?? 'us-east-1';
    if (
      this.bucket &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    ) {
      this.s3 = new S3Client({ region });
    }
  }

  /** Retorna URL persistida (s3://bucket/key ou local://rel) e tamanho. */
  async persist(params: {
    solicitacaoId: string;
    buffer: Buffer;
    mimeType: string;
    originalName: string;
  }): Promise<{ url: string; storageKey: string }> {
    const safe = sanitizeFilename(params.originalName);
    const key = `${PREFIX}/${params.solicitacaoId}/${randomUUID()}_${safe}`;

    if (this.s3 && this.bucket) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: params.buffer,
          ContentType: params.mimeType,
        }),
      );
      const url = `s3://${this.bucket}/${key}`;
      this.logger.log(`Anexo S3 ${key}`);
      return { url, storageKey: key };
    }

    const base = path.join(process.cwd(), 'uploads', 'solicitacoes', params.solicitacaoId);
    fs.mkdirSync(base, { recursive: true });
    const file = `${randomUUID()}_${safe}`;
    const full = path.join(base, file);
    fs.writeFileSync(full, params.buffer);
    const url = `local://${params.solicitacaoId}/${file}`;
    this.logger.warn(`Anexo local (S3 não configurado): ${full}`);
    return { url, storageKey: `${params.solicitacaoId}/${file}` };
  }

  removeLocalIfApplicable(storedUrl: string): void {
    if (!storedUrl.startsWith('local://')) return;
    const rel = storedUrl.slice('local://'.length);
    const full = path.join(process.cwd(), 'uploads', 'solicitacoes', rel);
    try {
      fs.unlinkSync(full);
    } catch {
      /* ignore */
    }
  }

  /** Compensação saga gate: remove objetos já persistidos se a transação DB falhar. */
  async deleteUploadedObjects(urls: string[]): Promise<void> {
    for (const storedUrl of urls) {
      if (storedUrl.startsWith('s3://') && this.s3 && this.bucket) {
        const key = storedUrl.slice(`s3://${this.bucket}/`.length);
        try {
          await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
        } catch (e) {
          this.logger.warn(`Falha ao remover S3 ${key}: ${(e as Error).message}`);
        }
        continue;
      }
      this.removeLocalIfApplicable(storedUrl);
    }
  }
}
