import { Injectable, Logger } from '@nestjs/common';
import { ObjectStorageService } from '../common/storage/object-storage.service';

const NAMESPACE = 'vistorias';
const PREFIX = 'logistica/vistorias';

@Injectable()
export class VistoriaStorageService {
  private readonly logger = new Logger(VistoriaStorageService.name);

  constructor(private readonly storage: ObjectStorageService) {}

  async persistPhoto(params: {
    solicitacaoId: string;
    vistoriaId: string;
    angulo: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<{ url: string; storageKey: string }> {
    const ext = params.mimeType.includes('png') ? 'png' : 'jpg';
    const filename = `${params.angulo}.${ext}`;

    if (this.storage.usesS3()) {
      const result = await this.storage.putBuffer({
        namespace: PREFIX,
        parts: [params.solicitacaoId, params.vistoriaId],
        filename,
        buffer: params.buffer,
        mimeType: params.mimeType,
      });
      this.logger.log(`Vistoria foto S3 ${result.storageKey}`);
      return result;
    }

    return this.storage.putBuffer({
      namespace: NAMESPACE,
      parts: [params.solicitacaoId, params.vistoriaId],
      filename,
      buffer: params.buffer,
      mimeType: params.mimeType,
    });
  }

  readLocalFile(storageKey: string): { buffer: Buffer; mimeType: string } {
    return this.storage.readLocal(NAMESPACE, storageKey);
  }

  async deleteObjects(storageKeys: string[]): Promise<void> {
    await this.storage.deleteKeys(storageKeys);
  }
}
