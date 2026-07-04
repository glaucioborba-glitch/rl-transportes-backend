import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TERMOS_USO_CONTEUDO_HTML,
  TERMOS_USO_DATA_PUBLICACAO,
  TERMOS_USO_TEXTO_PLAIN,
  TERMOS_USO_VERSAO_ATIVA,
} from './termos-uso.constants';

export type TermosUsoAtivo = {
  versao: string;
  conteudoHtml: string;
  conteudoTexto: string;
  dataPublicacao: string;
};

@Injectable()
export class TermosUsoService {
  constructor(private readonly prisma: PrismaService) {}

  async getAtivo(): Promise<TermosUsoAtivo> {
    const row = await this.prisma.termosUso.findFirst({
      where: { ativo: true },
      orderBy: { dataPublicacao: 'desc' },
    });
    if (row) {
      return {
        versao: row.versao,
        conteudoHtml: row.conteudoHtml,
        conteudoTexto: row.conteudoHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        dataPublicacao: row.dataPublicacao.toISOString(),
      };
    }
    return {
      versao: TERMOS_USO_VERSAO_ATIVA,
      conteudoHtml: TERMOS_USO_CONTEUDO_HTML,
      conteudoTexto: TERMOS_USO_TEXTO_PLAIN,
      dataPublicacao: TERMOS_USO_DATA_PUBLICACAO.toISOString(),
    };
  }

  async resolveVersaoAtiva(): Promise<string> {
    const ativo = await this.getAtivo();
    return ativo.versao;
  }
}
