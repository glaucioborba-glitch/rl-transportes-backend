import { randomUUID } from 'crypto';
import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ObjectStorageService } from '../../common/storage/object-storage.service';

const PREFIX = 'logistica/solicitacoes';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) || 'arquivo';
}

@Injectable()
export class SolicitacaoAnexoStorageService {
  private readonly logger = new Logger(SolicitacaoAnexoStorageService.name);

  constructor(private readonly storage: ObjectStorageService) {}

  /** Retorna URL persistida (http(s) ou local API) e chave de storage. */
  async persist(params: {
    solicitacaoId: string;
    buffer: Buffer;
    mimeType: string;
    originalName: string;
  }): Promise<{ url: string; storageKey: string; size: number; mimeType: string }> {
    const ext = path.extname(params.originalName) || '';
    const safe = sanitizeFilename(params.originalName);
    const key = `${PREFIX}/${params.solicitacaoId}/${randomUUID()}_${safe}${ext && !safe.endsWith(ext) ? ext : ''}`;

    const result = await this.storage.upload({
      key,
      body: params.buffer,
      contentType: params.mimeType,
      localServePath: `/v2/solicitacoes/anexos/media/${encodeURIComponent(key)}`,
    });

    this.logger.log(`Anexo persistido ${result.storageKey}`);
    return {
      url: result.url,
      storageKey: result.storageKey,
      size: params.buffer.length,
      mimeType: params.mimeType,
    };
  }

  removeLocalIfApplicable(storedUrl: string): void {
    if (!storedUrl.startsWith('local://') && !storedUrl.includes('/uploads/')) return;
    /* legado local:// — cleanup via deleteUploadedObjects */
  }

  async deleteUploadedObjects(urlsOrKeys: string[]): Promise<void> {
    const keys = urlsOrKeys.map((u) => {
      if (u.startsWith('s3://')) {
        const bucket = process.env.AWS_S3_BUCKET ?? '';
        return u.slice(`s3://${bucket}/`.length);
      }
      if (u.startsWith('http')) {
        try {
          const parsed = new URL(u);
          return parsed.pathname.replace(/^\//, '');
        } catch {
          return u;
        }
      }
      return u;
    });
    await this.storage.deleteMany(keys.filter(Boolean));
  }
}
