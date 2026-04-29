import { Injectable } from '@nestjs/common';

@Injectable()
export class MobilePinLockoutStore {
  private readonly falhas = new Map<string, number[]>();

  registrarFalha(chave: string) {
    const now = Date.now();
    const janela = 900_000;
    const arr = (this.falhas.get(chave) ?? []).filter((t) => now - t < janela);
    arr.push(now);
    this.falhas.set(chave, arr);
  }

  bloqueado(chave: string, max = 8): boolean {
    const now = Date.now();
    const arr = (this.falhas.get(chave) ?? []).filter((t) => now - t < 900_000);
    return arr.length >= max;
  }

  limpar(chave: string) {
    this.falhas.delete(chave);
  }
}
