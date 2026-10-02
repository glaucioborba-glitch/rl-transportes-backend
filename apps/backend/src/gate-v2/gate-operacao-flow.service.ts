import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import {
  AcaoAuditoria,
  Prisma,
  StatusContainer,
  StatusSolicitacao,
  TipoCaminhao,
} from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  canTransition,
  OperacaoFluxoJson,
  OperacaoState,
  STATE_LABELS,
} from './operacao-states.constants';
import { buildQrOnApproval, qrEstaAtivo } from './operacao-fluxo-qr.util';
import type { AssinaturaRicDto } from './dto/assinatura-ric.dto';
import { generateRicPdfA4Dupla } from './ric-pdf-a4-dupla';
import { generateRicPdfTermica80, usaRicTermica80 } from './ric-pdf-termica';
import { generateRICPDF, type RICData } from './ric-pdf.service';
import { EmpresaOperadoraService } from '../tenant/empresa-operadora.service';
import { CatalogoContainersService } from '../catalogo-containers/catalogo-containers.service';
import { CatalogoNaviosService } from '../catalogo-navios/catalogo-navios.service';
import { MotoristaBiometriaService } from '../motorista-biometria/motorista-biometria.service';
import { GateUnidadeNotificacaoService } from './gate-unidade-notificacao.service';
import {
  deltasDePatch,
  LABEL_PATCH_CONTAINER,
  LABEL_PATCH_TRANSPORTE,
} from './gate-unidade-notificacao.util';
import { ASSINATURA_BIOMETRIA_OK, isAssinaturaBiometria } from './assinatura-ric.util';
import {
  lacreRic,
  lacreTrocaPatio,
  textoLacreTroca,
} from '../common/utils/lacre-operacional.util';
import { composeObservacao, separarObservacaoLivreEEfeitos } from '../cadastros/servico-efeito';
import { stripContainerIsoCanonical } from '../common/utils/data-sanitize';
import {
  formatTamanhoContainerMatrix,
  formatTipoContainerCodigo,
  formatTipoTamanhoContainerLabel,
  normalizeTamanhoContainer,
  normalizeTamanhosContainer,
  resolveTipoContainerCodigo,
  TAMANHOS_CONTAINER_ORDEM,
} from '../cadastros/tipo-container-tamanhos.util';
import {
  aplicarConfirmacaoGate,
  buildConferencia,
  caboTomadaFotoObrigatoria,
  caboTomadaFotoPresente,
  colunaControle,
  lacreFotoObrigatoria,
  lacreFotoPresente,
  mensagemCaboTomadaFotoObrigatoria,
  mensagemDevolucaoPortaria,
  mensagemLacreFotoObrigatoria,
  mergeFotosVistoria,
  removerFotosRefazer,
  tiposEquivalentesFoto,
  fotosVistoriaObrigatoriasAusentes,
  rotuloFotoVistoria,
  origemValorConferenciaOcr,
  ALIASES_FOTO_REFAZER,
  type MotivoDevolverPortaria,
  normalizeContainer,
  normalizeCpf,
  normalizeLacre,
  normalizePlaca,
  rotuloTipoCaminhao,
  rotuloTipoOperacao,
} from './conferencia-entrada-saida.util';
import {
  buildOcrIndicativoTipo,
  parseContainerExtras,
  temContainerOcrExtras,
  type ContainerOcrExtras,
  type OcrIndicativoTipo,
} from '../modules/ocr/utils/ocr-parsers';
import {
  direcaoUnidade,
  formatUnidadeProcessoId,
  rotuloDirecaoUnidade,
} from '../unidade-processo/unidade-direcao.util';
import { UnidadeProcessoService } from '../unidade-processo/unidade-processo.service';
import { AuthService } from '../auth/auth.service';
import { DEFAULT_TENANT_ID } from '../tenant/tenant.constants';
import type { PassThrough } from 'stream';

const SOLICITACAO_INCLUDE = {
  cliente: true,
  portaria: {
    include: {
      cadastroTransportadora: {
        select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
      },
    },
  },
  gate: true,
  transporteSolicitacao: true,
  containersSolicitacao: { orderBy: { ordem: 'asc' as const } },
  agendamentoSolicitacao: true,
  unidadeProcessosEntrada: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  unidadeProcessosSaida: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  gateCheckIns: {
    where: { checkOut: null },
    orderBy: { dataHora: 'desc' as const },
    take: 1,
    select: { id: true },
  },
} satisfies Prisma.SolicitacaoInclude;

type SolicitacaoFull = Prisma.SolicitacaoGetPayload<{ include: typeof SOLICITACAO_INCLUDE }>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rotuloTransportadora(row: {
  razaoSocial: string;
  nomeFantasia: string | null;
}): string {
  return row.nomeFantasia?.trim() || row.razaoSocial;
}

function transportadoraDoDossie(s: SolicitacaoFull): {
  id: string | null;
  nome: string;
  cnpj: string;
} {
  const cad = s.portaria?.cadastroTransportadora;
  if (cad) {
    return { id: cad.id, nome: rotuloTransportadora(cad), cnpj: cad.cnpj };
  }
  const nome = s.portaria?.transportadoraNome?.trim() || '';
  if (nome && nome !== '—') return { id: null, nome, cnpj: '' };
  return { id: null, nome: '', cnpj: '' };
}

@Injectable()
export class GateOperacaoFlowService {
  private readonly logger = new Logger(GateOperacaoFlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly unidadeProcesso: UnidadeProcessoService,
    private readonly auth: AuthService,
    private readonly empresa: EmpresaOperadoraService,
    private readonly catalogoContainers: CatalogoContainersService,
    private readonly catalogoNavios: CatalogoNaviosService,
    private readonly biometria: MotoristaBiometriaService,
    private readonly gateNotificacoes: GateUnidadeNotificacaoService,
  ) {}

  private parseFluxoJson(raw: Prisma.JsonValue | null): OperacaoFluxoJson {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw as OperacaoFluxoJson;
  }

  private inferState(s: SolicitacaoFull): OperacaoState {
    if (s.operacaoFluxoEstado) {
      return s.operacaoFluxoEstado as OperacaoState;
    }
    if (s.status === StatusSolicitacao.REJEITADO) return 'REJEITADA';
    if (s.status === StatusSolicitacao.CONCLUIDO) return 'CONCLUIDA';
    if (s.status === StatusSolicitacao.PENDENTE || s.status === StatusSolicitacao.EM_ANALISE) {
      return 'SOLICITADA';
    }
    if (s.status === StatusSolicitacao.AGUARDANDO_GATE_IN) return 'AGUARDANDO_CHEGADA';
    if (s.status === StatusSolicitacao.EM_EXECUCAO && s.portaria) return 'VISTORIA_FOTOGRAFICA';
    if (s.status === StatusSolicitacao.EM_PATIO) return 'LIBERADA_OPERACAO';
    return 'SOLICITADA';
  }

  private async findByProtocolo(protocolo: string): Promise<SolicitacaoFull> {
    const s = await this.prisma.solicitacao.findFirst({
      where: { protocolo, deletedAt: null },
      include: SOLICITACAO_INCLUDE,
    });
    if (!s) throw new NotFoundException('Operação não encontrada');
    return s;
  }

  private containerNumero(s: SolicitacaoFull): string {
    const c = s.containersSolicitacao[0];
    return c?.unidade?.trim() || '—';
  }

  private jsonStringList(raw: Prisma.JsonValue | null | undefined): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  }

  private ocrFoto(
    fotos: Array<{ tipo: string; ocrResult?: string }>,
    tipos: string[],
  ): string {
    for (const tipo of tipos) {
      const hit = fotos.find((f) => f.tipo === tipo)?.ocrResult?.trim();
      if (hit) return hit;
    }
    return '';
  }

  private extrasFotoContainer(
    fotos: Array<{
      tipo: string;
      ocrExtras?: ContainerOcrExtras;
      ocrTextoBruto?: string;
    }>,
  ): ContainerOcrExtras {
    const foto = fotos.find((f) => f.tipo === 'CONTAINER_OCR');
    if (!foto) return {};
    if (temContainerOcrExtras(foto.ocrExtras)) return foto.ocrExtras ?? {};
    return parseContainerExtras(foto.ocrTextoBruto ?? '');
  }

  private ocrIndicativoTipo(
    fotos: Array<{
      tipo: string;
      ocrExtras?: ContainerOcrExtras;
      ocrTextoBruto?: string;
    }>,
    tipoCadastro?: string,
    tamanhoCadastro?: string,
  ): OcrIndicativoTipo | null {
    return buildOcrIndicativoTipo(
      this.extrasFotoContainer(fotos),
      tipoCadastro,
      tamanhoCadastro,
      formatTipoTamanhoContainerLabel(tipoCadastro, tamanhoCadastro) ?? '',
    );
  }

  private mapOperacaoDto(s: SolicitacaoFull, opts?: { compact?: boolean }) {
    const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
    const state = this.inferState(s);
    const t = s.transporteSolicitacao;
    const c = s.containersSolicitacao[0];
    const fotos = fluxo.vistoria?.fotos ?? [];
    const ocrContainer = this.ocrFoto(fotos, ['CONTAINER_OCR']);
    const ocrPlacaCavalo = this.ocrFoto(fotos, ['PLACA_CAVALO_OCR', 'PLACA_OCR']);
    const ocrPlacaCarreta = this.ocrFoto(fotos, [
      'PLACA_CARRETA_OCR',
      'PLACA_CARRETA01_OCR',
      'PLACA_CARRETA_01_OCR',
    ]);
    const ocrPlacaCarreta02 = this.ocrFoto(fotos, [
      'PLACA_CARRETA_02_OCR',
      'PLACA_CARRETA02_OCR',
    ]);
    const ocrLacre = this.ocrFoto(fotos, ['LACRE_OCR', 'LACRE']);
    const fotosLacrePortaria = this.jsonStringList(s.portaria?.fotosLacre);
    const lacreObrigatorio = lacreFotoObrigatoria(c?.status, c?.tipo);
    const lacrePresente = lacreFotoPresente(fotos, fotosLacrePortaria);
    const caboObrigatorio = caboTomadaFotoObrigatoria(c?.tipo, c?.refrigerado);
    const caboPresente = caboTomadaFotoPresente(fotos);
    const conferencia = aplicarConfirmacaoGate(
      buildConferencia({
        solicitado: {
          container: this.containerNumero(s),
          placaCavalo: t?.placaCavalo?.trim() || '',
          placaCarreta: t?.placaCarreta01?.trim() || '',
          placaCarreta02: t?.placaCarreta02?.trim() || '',
          lacre: c?.lacre?.trim() || '',
          motorista: t?.nomeMotorista?.trim() || '',
          cpf: t?.cpfMotorista?.trim() || '',
          tipoCaminhao: t?.tipoCaminhao ? String(t.tipoCaminhao) : '',
        },
        portaria: {
          placa: s.portaria?.placaVeiculo?.trim() || '',
          motorista: s.portaria?.motoristaNome?.trim() || '',
          cpf: s.portaria?.motoristaCpf?.trim() || '',
        },
        ocrContainer,
        ocrPlacaCavalo,
        ocrPlacaCarreta,
        ocrPlacaCarreta02,
        ocrLacre,
      }),
      fluxo.correcoesGate?.confirmados,
    );
    const coluna =
      s.status === StatusSolicitacao.AGUARDANDO_GATE_OUT
        ? 'PRONTO_SAIDA'
        : colunaControle(state, s.updatedAt);
    const tipoOp = s.tipoOperacao ? String(s.tipoOperacao) : '';
    const direcao = direcaoUnidade(tipoOp);
    const processoRow =
      direcao === 'SAIDA'
        ? (s.unidadeProcessosSaida?.[0] ?? s.unidadeProcessosEntrada?.[0] ?? null)
        : (s.unidadeProcessosEntrada?.[0] ?? s.unidadeProcessosSaida?.[0] ?? null);
    const unidadeProcesso = processoRow
      ? {
          id: processoRow.id,
          numero: processoRow.numero,
          label: formatUnidadeProcessoId(processoRow.numero),
          status: processoRow.status,
          entradaEm: processoRow.entradaEm.toISOString(),
          saidaEm: processoRow.saidaEm?.toISOString() ?? null,
        }
      : null;
    const transp = transportadoraDoDossie(s);
    const observacaoSeparada = separarObservacaoLivreEEfeitos(
      fluxo.observacaoGate,
      fluxo.observacoesEfeito,
    );

    return {
      id: s.id,
      protocolo: s.protocolo,
      state,
      stateLabel: STATE_LABELS[state],
      etapa: state,
      coluna,
      gateInId: s.gateCheckIns[0]?.id ?? null,
      containerNumero: this.containerNumero(s),
      containerTipo: c?.tipo ? resolveTipoContainerCodigo(c.tipo) : '—',
      containerTamanho: c?.tamanho ? formatTamanhoContainerMatrix(c.tamanho) : '—',
      containerSituacao: c?.status ?? '—',
      containerRefrigerado: Boolean(c?.refrigerado),
      containerSetPoint: c?.setPoint ?? null,
      placa: t?.placaCavalo?.trim() || s.portaria?.placaVeiculo || '—',
      motoristaNome: t?.nomeMotorista?.trim() || s.portaria?.motoristaNome || '—',
      motoristaCpf: t?.cpfMotorista?.trim() || s.portaria?.motoristaCpf || '',
      transportadoraNome: transp.nome || '—',
      transportadoraId: transp.id,
      transportadoraCnpj: transp.cnpj || '',
      clienteNome: s.cliente.nomeFantasia || s.cliente.razaoSocial,
      tipoOperacao: tipoOp || '—',
      tipoOperacaoLabel: rotuloTipoOperacao(tipoOp),
      direcaoUnidade: direcao,
      direcaoUnidadeLabel: rotuloDirecaoUnidade(direcao),
      unidadeProcesso,
      tatInicio: fluxo.tatInicio ?? null,
      tatFim: fluxo.tatFim ?? null,
      vistoria: opts?.compact ? null : (fluxo.vistoria ?? null),
      avariasCount: fluxo.vistoria?.avarias?.length ?? 0,
      fotosCount: fotos.length,
      ricAssinado: s.gate?.ricAssinado ?? false,
      assinaturaPresente: Boolean(fluxo.assinatura) || fluxo.assinaturaModo === 'MANUAL',
      assinaturaModo: fluxo.assinaturaModo ?? null,
      lacreFotoObrigatoria: lacreObrigatorio,
      lacreFotoPresente: lacrePresente,
      caboTomadaFotoObrigatoria: caboObrigatorio,
      caboTomadaFotoPresente: caboPresente,
      devolucaoPortaria: fluxo.devolucaoPortaria ?? null,
      observacaoGate: observacaoSeparada.livre,
      observacoesEfeito: observacaoSeparada.efeitos,
      confirmadosGate: fluxo.correcoesGate?.confirmados ?? [],
      conferencia,
      ocrIndicativos: opts?.compact
        ? undefined
        : { tipo: this.ocrIndicativoTipo(fotos as never, c?.tipo, c?.tamanho) },
      dossie: {
        solicitacao: {
          container: this.containerNumero(s),
          tipo: c?.tipo ? resolveTipoContainerCodigo(c.tipo) : '—',
          tamanho: c?.tamanho ? formatTamanhoContainerMatrix(c.tamanho) : '—',
          situacao: c?.status ?? '—',
          lacre: c?.lacre?.trim() || '',
          booking: c?.booking?.trim() || '',
          processo: c?.processo?.trim() || '',
          navio: c?.navio?.trim() || '',
          refrigerado: Boolean(c?.refrigerado),
          setPoint: c?.setPoint ?? null,
          unidadeProcessoNumero: unidadeProcesso?.numero ?? null,
          unidadeProcessoLabel: unidadeProcesso?.label ?? '',
          direcaoUnidade: direcao,
          direcaoUnidadeLabel: rotuloDirecaoUnidade(direcao),
          placa: t?.placaCavalo?.trim() || '—',
          placaCavalo: t?.placaCavalo?.trim() || '—',
          placaCarreta: t?.placaCarreta01?.trim() || '—',
          placaCarreta02: t?.placaCarreta02?.trim() || '',
          tipoCaminhao: t?.tipoCaminhao ? String(t.tipoCaminhao) : '',
          tipoCaminhaoLabel: rotuloTipoCaminhao(t?.tipoCaminhao ? String(t.tipoCaminhao) : ''),
          motorista: t?.nomeMotorista?.trim() || '—',
          cpf: t?.cpfMotorista?.trim() || '',
          tipoOperacao: rotuloTipoOperacao(tipoOp),
          cliente: s.cliente.nomeFantasia || s.cliente.razaoSocial,
          dataRef: s.agendamentoSolicitacao?.dataRef
            ? s.agendamentoSolicitacao.dataRef.toISOString().slice(0, 10)
            : null,
          turno: s.agendamentoSolicitacao?.turno ?? null,
        },
        portaria: {
          placa: s.portaria?.placaVeiculo?.trim() || '—',
          motorista: s.portaria?.motoristaNome?.trim() || '—',
          cpf: s.portaria?.motoristaCpf?.trim() || '',
          transportadora: transp.nome || '—',
          transportadoraId: transp.id,
          transportadoraCnpj: transp.cnpj || '',
          checkinEm: s.portaria?.createdAt?.toISOString() ?? null,
          ocrContainer: ocrContainer || '—',
          ocrPlaca: ocrPlacaCavalo || '—',
          ocrPlacaCavalo: ocrPlacaCavalo || '—',
          ocrPlacaCarreta: ocrPlacaCarreta || '—',
          ocrPlacaCarreta02: ocrPlacaCarreta02 || '—',
          ocrLacre: ocrLacre || '—',
          fotosLacre: fotosLacrePortaria,
          fotosExtras: [
            ...this.jsonStringList(s.portaria?.fotosCaminhao),
            ...this.jsonStringList(s.portaria?.fotosContainer),
            ...this.jsonStringList(s.portaria?.fotosAvarias),
          ],
        },
      },
      qrToken: fluxo.qrToken ?? null,
      qrValidade: fluxo.qrValidade ?? null,
    };
  }

  private async toOperacaoDto(s: SolicitacaoFull, opts?: { compact?: boolean }) {
    const dto = this.mapOperacaoDto(s, opts);
    if (opts?.compact) return dto;
    return this.anexarLacreTroca(s, dto);
  }

  /** Troca de lacre no pátio — o operador do gate precisa ver o número atual e o da entrada. */
  private async anexarLacreTroca(
    s: SolicitacaoFull,
    dto: ReturnType<GateOperacaoFlowService['mapOperacaoDto']>,
  ) {
    const iso = stripContainerIsoCanonical(this.containerNumero(s));
    let processo =
      s.unidadeProcessosSaida?.[0] ?? s.unidadeProcessosEntrada?.[0] ?? null;
    if (!processo?.lacreSaida?.trim() && iso) {
      processo =
        (await this.unidadeProcesso.findAbertoPorIso(iso, this.prisma, {
          clienteId: s.clienteId,
        })) ?? processo;
    }
    if (!processo?.lacreSaida?.trim()) return dto;

    let lacreEntrada = s.containersSolicitacao[0]?.lacre ?? null;
    if (dto.direcaoUnidade === 'SAIDA' && processo.entradaSolicitacaoId) {
      const entrada = await this.prisma.containerSolicitacao.findMany({
        where: { solicitacaoId: processo.entradaSolicitacaoId },
        select: { unidade: true, lacre: true },
      });
      const match = entrada.find((c) => stripContainerIsoCanonical(c.unidade) === iso);
      if (match?.lacre?.trim()) lacreEntrada = match.lacre;
    }

    const troca = lacreTrocaPatio({
      lacreEntrada,
      lacreSaida: processo.lacreSaida,
      observacao: processo.lacreSaidaObservacao,
      origem: processo.lacreSaidaOrigem,
    });
    if (!troca) return dto;
    return {
      ...dto,
      lacreTroca: { ...troca, texto: textoLacreTroca(troca) },
    };
  }

  private async transition(
    s: SolicitacaoFull,
    to: OperacaoState,
    patchJson: Partial<OperacaoFluxoJson>,
    actorUserId: string,
    extraData?: Prisma.SolicitacaoUpdateInput,
  ) {
    const from = this.inferState(s);
    if (!canTransition(from, to)) {
      throw new BadRequestException(
        `Transição inválida: ${STATE_LABELS[from]} → ${STATE_LABELS[to]}`,
      );
    }
    const prevJson = this.parseFluxoJson(s.operacaoFluxoJson);
    const nextJson = { ...prevJson, ...patchJson };

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.solicitacao.update({
        where: { id: s.id },
        data: {
          operacaoFluxoEstado: to,
          operacaoFluxoJson: nextJson as Prisma.InputJsonValue,
          ...extraData,
        },
        include: SOLICITACAO_INCLUDE,
      });
      await this.auditoria.registrar(
        {
          tabela: 'solicitacoes',
          registroId: s.id,
          acao: AcaoAuditoria.UPDATE,
          usuario: actorUserId,
          solicitacaoId: s.id,
          dadosAntes: { operacaoFluxoEstado: from },
          dadosDepois: { operacaoFluxoEstado: to },
        },
        tx,
      );
      return updated;
    });
  }

  async getOperacao(protocolo: string) {
    const s = await this.findByProtocolo(protocolo);
    return this.toOperacaoDto(s);
  }

  /** Dropdown de tipo/tamanho e transportadoras do dossiê (cadastro MDM). */
  async catalogosConferencia(tenantId = DEFAULT_TENANT_ID) {
    const [tiposContainer, transportadoras] = await Promise.all([
      this.prisma.cadastroTipoContainer.findMany({
        where: { deletedAt: null, ativo: true },
        orderBy: { codigo: 'asc' },
        select: { codigo: true, nome: true, tamanhos: true, tomadaReefer: true },
      }),
      this.prisma.cadastroTransportadora.findMany({
        where: { tenantId, deletedAt: null, ativo: true },
        orderBy: { razaoSocial: 'asc' },
        select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
        take: 500,
      }),
    ]);

    return {
      tiposContainer: tiposContainer.map((t) => {
        const tamanhos = normalizeTamanhosContainer(t.tamanhos);
        return {
          codigo: formatTipoContainerCodigo(t.codigo),
          nome: t.nome,
          tamanhos: tamanhos.length ? tamanhos : [...TAMANHOS_CONTAINER_ORDEM],
          tomadaReefer: t.tomadaReefer,
        };
      }),
      transportadoras: transportadoras.map((t) => ({
        id: t.id,
        razaoSocial: t.razaoSocial,
        nomeFantasia: t.nomeFantasia,
        cnpj: t.cnpj,
        label: rotuloTransportadora(t),
      })),
    };
  }

  private async resolveTransportadoraPatch(raw: string, tenantId: string) {
    const value = raw.trim();
    if (!value) {
      return { cadastroTransportadoraId: null as string | null, transportadoraNome: null as string | null };
    }
    const byId = UUID_RE.test(value)
      ? await this.prisma.cadastroTransportadora.findFirst({
          where: { id: value, tenantId, deletedAt: null, ativo: true },
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        })
      : null;
    if (UUID_RE.test(value) && !byId) {
      throw new BadRequestException('Transportadora não cadastrada.');
    }
    const row =
      byId ??
      (await this.prisma.cadastroTransportadora.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          ativo: true,
          OR: [
            { razaoSocial: { equals: value, mode: 'insensitive' } },
            { nomeFantasia: { equals: value, mode: 'insensitive' } },
          ],
        },
        select: { id: true, razaoSocial: true, nomeFantasia: true },
      }));
    if (row) {
      return {
        cadastroTransportadoraId: row.id,
        transportadoraNome: rotuloTransportadora(row),
      };
    }
    return { cadastroTransportadoraId: null, transportadoraNome: value };
  }

  /**
   * Correção do Gate na conferência: campos sem OCR e OCR laranja.
   * Verde (OCR confere) permanece travado. O valor oficial vai para a solicitação/portaria.
   */
  async salvarCorrecoes(
    protocolo: string,
    body: {
      container?: string;
      tipo?: string;
      tamanho?: string;
      situacao?: string;
      booking?: string;
      processo?: string;
      navio?: string;
      lacre?: string;
      placaCavalo?: string;
      placaCarreta?: string;
      placaCarreta02?: string;
      tipoCaminhao?: string;
      motorista?: string;
      cpf?: string;
      transportadora?: string;
      transportadoraId?: string;
      observacao?: string;
      confirmar?: string[];
      gerenteToken?: string;
      motivo?: string;
    },
    actorUserId: string,
  ) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    const posRic: OperacaoState[] = [
      'RECONFIRMADA',
      'RIC_GERADO',
      'LIBERADA_OPERACAO',
      'EM_OPERACAO',
      'CONCLUIDA',
    ];
    if (state !== 'AGUARDANDO_RECONFIRMACAO' && !posRic.includes(state)) {
      throw new BadRequestException(
        `Correção não permitida no estado ${STATE_LABELS[state]}`,
      );
    }
    const edicaoAposRic = posRic.includes(state);
    let supervisor: { gerenteId: string; email: string; role: string } | null = null;
    if (edicaoAposRic) {
      if (!body.gerenteToken?.trim()) {
        throw new UnauthorizedException(
          'Edição após a RIC exige autorização de gerente.',
        );
      }
      supervisor = this.auth.assertRicSupervisorToken(body.gerenteToken, protocolo);
      const motivo = body.motivo?.trim() ?? '';
      if (motivo.length < 8) {
        throw new BadRequestException(
          'Informe o motivo da edição (mínimo 8 caracteres).',
        );
      }
      if (body.container != null) {
        throw new BadRequestException(
          'Contêiner, operação, direção, ID e cliente não podem ser alterados após a RIC.',
        );
      }
    }

    const atual = this.mapOperacaoDto(s);
    const byCampo = Object.fromEntries((atual.conferencia?.itens ?? []).map((i) => [i.campo, i]));
    const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
    const confirmados = new Set(fluxo.correcoesGate?.confirmados ?? []);
    const originais = { ...(fluxo.correcoesGate?.originais ?? {}) };

    const ocrTravado = (campo: string) => {
      if (edicaoAposRic) return false;
      const item = byCampo[campo];
      return item?.status === 'CONFERE' && !confirmados.has(campo);
    };

    const itemConferencia = (campo: string) =>
      byCampo[campo] ?? (campo === 'placaCavalo' ? byCampo.placa : undefined);

    const assertSomenteAgendaOuOcr = (
      campo: string,
      informado: string,
      normalizar: (value: string | null | undefined) => string,
    ): 'ocr' | 'agendamento' => {
      const item = itemConferencia(campo);
      const origem = origemValorConferenciaOcr(
        item?.solicitado,
        item?.capturado,
        informado,
        normalizar,
      );
      if (!origem) {
        throw new BadRequestException(
          'Na conferência, confirme os dados do agendamento ou os dados do OCR. Não é permitido digitar outro valor.',
        );
      }
      return origem;
    };

    const t = s.transporteSolicitacao;
    const c = s.containersSolicitacao[0];
    const transporteData: Prisma.TransporteSolicitacaoUpdateInput = {};
    const containerData: Prisma.ContainerSolicitacaoUpdateInput = {};
    let transportadoraPatch:
      | { cadastroTransportadoraId: string | null; transportadoraNome: string | null }
      | undefined;

    const registrarOriginal = (campo: string, valorAtual: string) => {
      if (originais[campo] == null) originais[campo] = valorAtual;
      confirmados.add(campo);
    };

    const catalogoTipos =
      body.tipo != null || body.tamanho != null
        ? await this.prisma.cadastroTipoContainer.findMany({
            where: { deletedAt: null, ativo: true },
            select: { codigo: true, tamanhos: true },
          })
        : [];
    const catalogoCodigos = catalogoTipos.map((row) => row.codigo.toUpperCase());
    const tamanhosDoTipo = (codigo: string) => {
      const row = catalogoTipos.find((r) => r.codigo.toUpperCase() === codigo);
      const tams = normalizeTamanhosContainer(row?.tamanhos);
      return tams.length ? tams : [...TAMANHOS_CONTAINER_ORDEM];
    };

    if (body.container != null) {
      if (ocrTravado('container')) {
        throw new BadRequestException('Contêiner conferido pelo OCR não pode ser alterado');
      }
      const next = normalizeContainer(body.container);
      if (!next) throw new BadRequestException('Número do contêiner inválido');
      if (assertSomenteAgendaOuOcr('container', next, normalizeContainer) === 'agendamento') {
        confirmados.add('container');
      } else {
        registrarOriginal('container', this.containerNumero(s));
        containerData.unidade = next;
      }
    }
    if (body.tipo != null) {
      const next = resolveTipoContainerCodigo(body.tipo, catalogoCodigos);
      if (!next) throw new BadRequestException('Tipo de contêiner inválido');
      const atual = resolveTipoContainerCodigo(c?.tipo, catalogoCodigos);
      if (catalogoCodigos.length && !catalogoCodigos.includes(next) && next !== atual) {
        throw new BadRequestException('Tipo de contêiner não cadastrado');
      }
      registrarOriginal('tipo', c?.tipo ?? '');
      containerData.tipo = next;
      const allowed = tamanhosDoTipo(next);
      const tamanhoAtual = normalizeTamanhoContainer(body.tamanho ?? c?.tamanho);
      if (allowed.length && tamanhoAtual && !allowed.includes(tamanhoAtual)) {
        registrarOriginal('tamanho', c?.tamanho ?? '');
        containerData.tamanho = allowed[0];
      }
    }
    if (body.tamanho != null) {
      const next = normalizeTamanhoContainer(body.tamanho);
      if (!(TAMANHOS_CONTAINER_ORDEM as readonly string[]).includes(next)) {
        throw new BadRequestException('Tamanho deve ser 20, 40 ou 45');
      }
      const tipoRef = resolveTipoContainerCodigo(
        typeof containerData.tipo === 'string' ? containerData.tipo : c?.tipo,
        catalogoCodigos,
      );
      const allowed = tipoRef ? tamanhosDoTipo(tipoRef) : [...TAMANHOS_CONTAINER_ORDEM];
      if (allowed.length && !allowed.includes(next)) {
        throw new BadRequestException(`Tamanho ${next}' não disponível para este tipo`);
      }
      registrarOriginal('tamanho', c?.tamanho ?? '');
      containerData.tamanho = next;
    }
    if (body.situacao != null) {
      const next = String(body.situacao).toUpperCase();
      if (next !== 'CHEIO' && next !== 'VAZIO') {
        throw new BadRequestException('Situação deve ser CHEIO ou VAZIO');
      }
      registrarOriginal('situacao', c?.status ?? '');
      containerData.status = next as StatusContainer;
    }
    if (body.navio != null) {
      const next = String(body.navio).trim().slice(0, 120);
      registrarOriginal('navio', c?.navio ?? '');
      containerData.navio = next;
    }
    if (body.processo != null) {
      const next = String(body.processo).trim().slice(0, 120);
      registrarOriginal('processo', c?.processo ?? '');
      containerData.processo = next;
    }
    if (body.booking != null) {
      const next = String(body.booking).trim().slice(0, 120);
      registrarOriginal('booking', c?.booking ?? '');
      containerData.booking = next;
    }
    if (body.lacre != null) {
      if (ocrTravado('lacre')) {
        throw new BadRequestException('Lacre conferido pelo OCR não pode ser alterado');
      }
      const next = normalizeLacre(body.lacre);
      if (assertSomenteAgendaOuOcr('lacre', next || body.lacre, normalizeLacre) === 'agendamento') {
        confirmados.add('lacre');
      } else {
        registrarOriginal('lacre', c?.lacre ?? '');
        containerData.lacre = next || null;
      }
    }
    if (body.placaCavalo != null) {
      if (ocrTravado('placaCavalo')) {
        throw new BadRequestException('Placa cavalo conferida pelo OCR não pode ser alterada');
      }
      const next = normalizePlaca(body.placaCavalo);
      if (next.length < 7) throw new BadRequestException('Placa do cavalo inválida');
      if (assertSomenteAgendaOuOcr('placaCavalo', next, normalizePlaca) === 'agendamento') {
        confirmados.add('placaCavalo');
      } else {
        registrarOriginal('placaCavalo', t?.placaCavalo ?? '');
        transporteData.placaCavalo = next;
      }
    }
    if (body.placaCarreta != null) {
      if (ocrTravado('placaCarreta')) {
        throw new BadRequestException('Placa carreta conferida pelo OCR não pode ser alterada');
      }
      const next = normalizePlaca(body.placaCarreta);
      if (next.length < 7) throw new BadRequestException('Placa da carreta inválida');
      if (assertSomenteAgendaOuOcr('placaCarreta', next, normalizePlaca) === 'agendamento') {
        confirmados.add('placaCarreta');
      } else {
        registrarOriginal('placaCarreta', t?.placaCarreta01 ?? '');
        transporteData.placaCarreta01 = next;
      }
    }
    if (body.placaCarreta02 != null) {
      if (ocrTravado('placaCarreta02')) {
        throw new BadRequestException('Placa carreta 02 conferida pelo OCR não pode ser alterada');
      }
      const next = normalizePlaca(body.placaCarreta02);
      if (assertSomenteAgendaOuOcr('placaCarreta02', next, normalizePlaca) === 'agendamento') {
        confirmados.add('placaCarreta02');
      } else {
        registrarOriginal('placaCarreta02', t?.placaCarreta02 ?? '');
        transporteData.placaCarreta02 = next || null;
      }
    }
    if (body.tipoCaminhao != null) {
      const next = String(body.tipoCaminhao).toUpperCase();
      if (next !== 'LS' && next !== 'RODOTREM') {
        throw new BadRequestException('Tipo de caminhão deve ser LS ou RODOTREM');
      }
      registrarOriginal('tipoCaminhao', t?.tipoCaminhao ? String(t.tipoCaminhao) : '');
      transporteData.tipoCaminhao = next as TipoCaminhao;
    }
    if (body.motorista != null) {
      const next = String(body.motorista).trim();
      if (!next) throw new BadRequestException('Nome do motorista inválido');
      registrarOriginal('motorista', t?.nomeMotorista ?? '');
      transporteData.nomeMotorista = next;
    }
    if (body.cpf != null) {
      const next = normalizeCpf(body.cpf);
      if (next.length !== 11) throw new BadRequestException('CPF deve ter 11 dígitos');
      registrarOriginal('cpf', t?.cpfMotorista ?? '');
      transporteData.cpfMotorista = next;
    }
    if (body.transportadoraId !== undefined || body.transportadora !== undefined) {
      const raw =
        body.transportadoraId !== undefined ? body.transportadoraId : (body.transportadora ?? '');
      registrarOriginal('transportadora', s.portaria?.transportadoraNome ?? '');
      transportadoraPatch = await this.resolveTransportadoraPatch(
        String(raw),
        s.tenantId || DEFAULT_TENANT_ID,
      );
    }
    for (const campo of Array.isArray(body.confirmar) ? body.confirmar : []) {
      confirmados.add(String(campo));
    }

    const temTransporte = Object.keys(transporteData).length > 0;
    const temContainer = Object.keys(containerData).length > 0;
    const soConfirmar = Array.isArray(body.confirmar) && body.confirmar.length > 0;
    const temObservacao = body.observacao != null;
    const soMotivo = Boolean(edicaoAposRic && body.motivo?.trim());
    if (
      !temTransporte &&
      !temContainer &&
      transportadoraPatch == null &&
      !soConfirmar &&
      !temObservacao &&
      !soMotivo
    ) {
      return atual;
    }

    const separado = separarObservacaoLivreEEfeitos(fluxo.observacaoGate, fluxo.observacoesEfeito);
    const observacaoGate = temObservacao
      ? String(body.observacao).trim().slice(0, 2000)
      : separado.livre;

    const nextFluxo = JSON.parse(
      JSON.stringify({
        ...fluxo,
        observacaoGate: observacaoGate || undefined,
        observacoesEfeito: separado.efeitos,
        correcoesGate: {
          confirmados: Array.from(confirmados),
          originais,
          alteradoEm: new Date().toISOString(),
          operadorId: actorUserId,
          ...(edicaoAposRic
            ? {
                motivo: body.motivo?.trim(),
                gerenteId: supervisor?.gerenteId,
                gerenteEmail: supervisor?.email,
              }
            : {}),
        },
      }),
    ) as OperacaoFluxoJson;

    await this.prisma.$transaction(async (tx) => {
      if (temTransporte && t) {
        await tx.transporteSolicitacao.update({ where: { id: t.id }, data: transporteData });
      }
      if (temContainer && c) {
        await tx.containerSolicitacao.update({ where: { id: c.id }, data: containerData });
        const novoIso =
          typeof containerData.unidade === 'string' ? containerData.unidade : null;
        if (novoIso) {
          await tx.unidadeProcesso.updateMany({
            where: {
              OR: [{ entradaSolicitacaoId: s.id }, { saidaSolicitacaoId: s.id }],
            },
            data: { unidadeIso: novoIso },
          });
        }
      }
      if (transportadoraPatch) {
        await tx.portaria.upsert({
          where: { solicitacaoId: s.id },
          create: {
            solicitacaoId: s.id,
            transportadoraNome: transportadoraPatch.transportadoraNome,
            cadastroTransportadoraId: transportadoraPatch.cadastroTransportadoraId,
          },
          update: {
            transportadoraNome: transportadoraPatch.transportadoraNome,
            cadastroTransportadoraId: transportadoraPatch.cadastroTransportadoraId,
          },
        });
      }
      await tx.solicitacao.update({
        where: { id: s.id },
        data: { operacaoFluxoJson: nextFluxo as Prisma.InputJsonValue },
      });
    });

    if (typeof containerData.navio === 'string') {
      void this.catalogoNavios.registrar(containerData.navio, 'GATE').catch((err) =>
        this.logger.warn(`Catálogo de navio não atualizou: ${(err as Error).message}`),
      );
    }

    try {
      await this.auditoria.registrar({
        tabela: 'solicitacoes',
        registroId: s.id,
        acao: AcaoAuditoria.UPDATE,
        usuario: actorUserId,
        solicitacaoId: s.id,
        dadosAntes: originais,
        dadosDepois: {
          confirmar: body.confirmar ?? [],
          campos: Object.keys(body).filter(
            (k) =>
              k !== 'confirmar' &&
              k !== 'gerenteToken' &&
              k !== 'motivo' &&
              (body as Record<string, unknown>)[k] != null,
          ),
          valores: Object.fromEntries(
            Object.entries(body).filter(
              ([k, v]) =>
                k !== 'confirmar' &&
                k !== 'gerenteToken' &&
                k !== 'motivo' &&
                v != null,
            ),
          ),
          ...(edicaoAposRic
            ? {
                motivo: body.motivo?.trim(),
                gerenteId: supervisor?.gerenteId,
                gerenteEmail: supervisor?.email,
                gerenteRole: supervisor?.role,
                travados: ['container', 'operacao', 'direcao', 'id', 'cliente'],
              }
            : {}),
        },
      });
    } catch {
      // Correção do Gate não pode falhar por auditoria.
    }

    const processoId =
      s.unidadeProcessosEntrada[0] ?? s.unidadeProcessosSaida[0] ?? null;
    if (processoId) {
      const mudancas = [
        ...deltasDePatch(
          containerData as Record<string, unknown>,
          (c ?? null) as Record<string, unknown> | null,
          LABEL_PATCH_CONTAINER,
        ),
        ...deltasDePatch(
          transporteData as Record<string, unknown>,
          (t ?? null) as Record<string, unknown> | null,
          LABEL_PATCH_TRANSPORTE,
        ),
      ];
      if (transportadoraPatch) {
        const antes = s.portaria?.transportadoraNome ?? '';
        const depois = transportadoraPatch.transportadoraNome ?? '';
        if (antes !== depois) {
          mudancas.push({
            campo: 'transportadora',
            label: 'Transportadora',
            antes,
            depois,
          });
        }
      }
      if (mudancas.length) {
        const operador = await this.prisma.user.findUnique({
          where: { id: actorUserId },
          select: { email: true, role: true },
        });
        void this.gateNotificacoes
          .registrar({
            tenantId: s.tenantId || DEFAULT_TENANT_ID,
            unidadeProcessoId: processoId.id,
            unidadeIso: processoId.unidadeIso,
            processoNumero: processoId.numero,
            origem: 'GATE',
            atorNome: operador?.email ?? actorUserId,
            atorRole: String(operador?.role ?? 'OPERADOR_GATE'),
            campos: mudancas,
          })
          .catch((err) =>
            this.logger.warn(
              `Notificação do Gate não gravou: ${(err as Error).message}`,
            ),
          );
      }
    }

    return this.toOperacaoDto(await this.findByProtocolo(protocolo));
  }

  async autorizarGerente(
    protocolo: string,
    documento: string,
    password: string,
    tenantId?: string,
  ) {
    await this.findByProtocolo(protocolo);
    const gerente = await this.auth.verifyGerenteCredentials(
      tenantId ?? DEFAULT_TENANT_ID,
      documento,
      password,
    );
    return this.auth.issueRicSupervisorToken(gerente, protocolo);
  }

  async excluirAposRic(
    protocolo: string,
    body: { gerenteToken?: string; documento?: string; password?: string },
    actorUserId: string,
    tenantId?: string,
  ) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    const posRic: OperacaoState[] = [
      'RECONFIRMADA',
      'RIC_GERADO',
      'LIBERADA_OPERACAO',
      'EM_OPERACAO',
      'CONCLUIDA',
    ];
    if (!posRic.includes(state)) {
      throw new BadRequestException(
        `Exclusão só após a RIC (atual: ${STATE_LABELS[state]})`,
      );
    }

    let gerenteId: string;
    if (body.gerenteToken?.trim()) {
      gerenteId = this.auth.assertRicSupervisorToken(body.gerenteToken, protocolo).gerenteId;
    } else if (body.documento && body.password) {
      const gerente = await this.auth.verifyGerenteCredentials(
        tenantId ?? DEFAULT_TENANT_ID,
        body.documento,
        body.password,
      );
      gerenteId = gerente.id;
    } else {
      throw new UnauthorizedException('Informe CPF e senha de gerente.');
    }

    const resultado = await this.unidadeProcesso.anularAposRic(s.id, gerenteId);
    try {
      await this.auditoria.registrar({
        tabela: 'solicitacoes',
        registroId: s.id,
        acao: AcaoAuditoria.DELETE,
        usuario: actorUserId,
        solicitacaoId: s.id,
        dadosDepois: {
          evento: 'RIC_ANULADA_GERENTE',
          gerenteId,
          direcao: resultado.direcao,
          unidadeProcessoId: resultado.unidadeProcessoId,
          numero: resultado.numero,
        },
      });
    } catch {
      // Auditoria não bloqueia a exclusão já persistida.
    }
    return {
      ok: true,
      direcao: resultado.direcao,
      idLabel: formatUnidadeProcessoId(resultado.numero),
    };
  }

  async listAguardandoChegada(search?: string) {
    const q = search?.trim();
    const where: Prisma.SolicitacaoWhereInput = q
      ? {
          deletedAt: null,
          operacaoFluxoEstado: {
            in: ['AGUARDANDO_CHEGADA', 'CHECKIN_PORTARIA', 'VISTORIA_FOTOGRAFICA'],
          },
          OR: [
            { protocolo: { contains: q, mode: 'insensitive' } },
            { transporteSolicitacao: { placaCavalo: { contains: q, mode: 'insensitive' } } },
            { containersSolicitacao: { some: { unidade: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : {
          deletedAt: null,
          status: StatusSolicitacao.AGUARDANDO_GATE_IN,
          OR: [
            { operacaoFluxoEstado: 'AGUARDANDO_CHEGADA' },
            { operacaoFluxoEstado: null },
          ],
        };
    const rows = await this.prisma.solicitacao.findMany({
      where,
      include: SOLICITACAO_INCLUDE,
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: rows.map((s) => ({
        protocolo: s.protocolo,
        containerNumero: this.containerNumero(s),
        containerTipo: s.containersSolicitacao[0]?.tipo
          ? resolveTipoContainerCodigo(s.containersSolicitacao[0].tipo)
          : '—',
        placa: s.transporteSolicitacao?.placaCavalo ?? '—',
        clienteNome: s.cliente.nomeFantasia || s.cliente.razaoSocial,
      })),
    };
  }

  async checkin(protocolo: string, actorUserId: string) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'AGUARDANDO_CHEGADA') {
      throw new BadRequestException(
        `Check-in permitido apenas em Aguardando Chegada (atual: ${STATE_LABELS[state]})`,
      );
    }
    await this.prisma.portaria.upsert({
      where: { solicitacaoId: s.id },
      create: {
        solicitacaoId: s.id,
        placaVeiculo: s.transporteSolicitacao?.placaCavalo ?? null,
        motoristaNome: s.transporteSolicitacao?.nomeMotorista ?? null,
      },
      update: {},
    });
    const updated = await this.transition(s, 'CHECKIN_PORTARIA', {}, actorUserId, {
      status: StatusSolicitacao.EM_EXECUCAO,
    });
    return this.toOperacaoDto(updated);
  }

  async submitVistoria(
    protocolo: string,
    body: {
      fotos: Array<{
        tipo: string;
        imagem: string;
        ocrResult?: string;
        ocrMatch?: boolean;
        ocrConfianca?: number;
        ocrProvider?: string;
        ocrTextoBruto?: string;
        ocrExtras?: ContainerOcrExtras;
      }>;
      avarias: Array<{ foto: string; descricao: string; localizacao: string }>;
    },
    actorUserId: string,
  ) {
    const s = await this.findByProtocolo(protocolo);
    let current = this.inferState(s);
    if (current === 'CHECKIN_PORTARIA') {
      const mid = await this.transition(s, 'VISTORIA_FOTOGRAFICA', {}, actorUserId);
      current = this.inferState(mid);
      Object.assign(s, mid);
    }
    if (current !== 'VISTORIA_FOTOGRAFICA') {
      throw new BadRequestException(
        `Vistoria permitida após check-in (atual: ${STATE_LABELS[current]})`,
      );
    }
    const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
    const fotos = mergeFotosVistoria(fluxo.vistoria?.fotos, body.fotos);
    const avarias =
      body.avarias.length > 0
        ? body.avarias.map((a) => ({ ...a, timestamp: new Date().toISOString() }))
        : (fluxo.vistoria?.avarias ?? []);
    const ausentes = fotosVistoriaObrigatoriasAusentes(
      fotos,
      s.transporteSolicitacao?.tipoCaminhao ? String(s.transporteSolicitacao.tipoCaminhao) : null,
    );
    if (ausentes.length) {
      throw new BadRequestException(
        `Foto obrigatória ausente: ${ausentes.map((t) => rotuloFotoVistoria(t)).join(', ')}`,
      );
    }
    const container = s.containersSolicitacao[0];
    if (
      lacreFotoObrigatoria(container?.status, container?.tipo) &&
      !lacreFotoPresente(fotos, this.jsonStringList(s.portaria?.fotosLacre))
    ) {
      throw new BadRequestException(mensagemLacreFotoObrigatoria());
    }
    if (
      caboTomadaFotoObrigatoria(container?.tipo, container?.refrigerado) &&
      !caboTomadaFotoPresente(fotos)
    ) {
      throw new BadRequestException(mensagemCaboTomadaFotoObrigatoria());
    }
    const updated = await this.transition(
      s,
      'AGUARDANDO_RECONFIRMACAO',
      {
        vistoria: {
          fotos,
          avarias,
          enviadaEm: new Date().toISOString(),
        },
        devolucaoPortaria: null,
      },
      actorUserId,
    );
    return this.toOperacaoDto(updated);
  }

  async getVistoria(protocolo: string) {
    return this.getOperacao(protocolo);
  }

  async devolverPortaria(
    protocolo: string,
    motivo: MotivoDevolverPortaria,
    fotosRefazer: string[],
    actorUserId: string,
  ) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'AGUARDANDO_RECONFIRMACAO') {
      throw new BadRequestException(
        `Devolução à portaria só na conferência do Gate (atual: ${STATE_LABELS[state]})`,
      );
    }
    const tipos = [...new Set(fotosRefazer.map((t) => String(t ?? '').toUpperCase()).filter(Boolean))];
    if (!tipos.length) {
      throw new BadRequestException('Selecione ao menos uma foto para a portaria refazer.');
    }
    const permitidos = new Set(Object.keys(ALIASES_FOTO_REFAZER));
    for (const tipo of tipos) {
      if (!permitidos.has(tipo) && !tiposEquivalentesFoto(tipo).some((a) => permitidos.has(a))) {
        throw new BadRequestException(`Tipo de foto inválido para devolução: ${tipo}`);
      }
    }

    const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
    const fotosRestantes = removerFotosRefazer(fluxo.vistoria?.fotos, tipos);
    const updated = await this.transition(
      s,
      'VISTORIA_FOTOGRAFICA',
      {
        vistoria: fluxo.vistoria
          ? {
              ...fluxo.vistoria,
              fotos: fotosRestantes,
            }
          : { fotos: [], avarias: [] },
        devolucaoPortaria: {
          motivo,
          fotosRefazer: tipos,
          mensagem: mensagemDevolucaoPortaria(motivo, tipos),
          devolvidaEm: new Date().toISOString(),
          operadorId: actorUserId,
        },
      },
      actorUserId,
    );
    return this.toOperacaoDto(updated);
  }

  async reconfirmar(
    protocolo: string,
    checklist: Record<string, boolean> | undefined,
    actorUserId: string,
  ) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'AGUARDANDO_RECONFIRMACAO') {
      throw new BadRequestException(
        `Reconfirmação permitida após vistoria (atual: ${STATE_LABELS[state]})`,
      );
    }
    const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
    const container = s.containersSolicitacao[0];
    if (
      lacreFotoObrigatoria(container?.status, container?.tipo) &&
      !lacreFotoPresente(fluxo.vistoria?.fotos, this.jsonStringList(s.portaria?.fotosLacre))
    ) {
      throw new BadRequestException(mensagemLacreFotoObrigatoria());
    }
    if (
      caboTomadaFotoObrigatoria(container?.tipo, container?.refrigerado) &&
      !caboTomadaFotoPresente(fluxo.vistoria?.fotos)
    ) {
      throw new BadRequestException(mensagemCaboTomadaFotoObrigatoria());
    }
    const updated = await this.transition(
      s,
      'RECONFIRMADA',
      {
        reconfirmacao: {
          checklist: checklist ?? { validadoGate: true },
          reconfirmadaEm: new Date().toISOString(),
          operadorId: actorUserId,
        },
      },
      actorUserId,
    );
    return this.toOperacaoDto(updated);
  }

  async rejeitar(
    protocolo: string,
    motivo: string,
    etapa: string,
    actorUserId: string,
  ) {
    const s = await this.findByProtocolo(protocolo);
    const from = this.inferState(s);
    if (from === 'CONCLUIDA' || from === 'REJEITADA') {
      throw new BadRequestException('Operação já finalizada');
    }
    const prevJson = this.parseFluxoJson(s.operacaoFluxoJson);
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.solicitacao.update({
        where: { id: s.id },
        data: {
          operacaoFluxoEstado: 'REJEITADA',
          status: StatusSolicitacao.REJEITADO,
          operacaoFluxoJson: {
            ...prevJson,
            rejeicao: { motivo, etapa, rejeitadaEm: new Date().toISOString() },
          } as Prisma.InputJsonValue,
        },
        include: SOLICITACAO_INCLUDE,
      });
      await this.auditoria.registrar(
        {
          tabela: 'solicitacoes',
          registroId: s.id,
          acao: AcaoAuditoria.UPDATE,
          usuario: actorUserId,
          solicitacaoId: s.id,
          dadosDepois: { operacaoFluxoEstado: 'REJEITADA', motivo, etapa },
        },
        tx,
      );
      return u;
    });
    return this.toOperacaoDto(updated);
  }

  async saveAssinatura(protocolo: string, body: AssinaturaRicDto, actorUserId: string) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'RECONFIRMADA' && state !== 'RIC_GERADO') {
      throw new BadRequestException('Assinatura permitida após reconfirmação');
    }
    const modo = body.modo === 'MANUAL' ? 'MANUAL' : 'DIGITAL';
    const rawAssinatura = (body.assinatura ?? '').trim();
    const usaBiometria =
      modo === 'DIGITAL' &&
      (body.biometriaVerificada === true || isAssinaturaBiometria(rawAssinatura));
    let assinatura = modo === 'MANUAL' ? '' : rawAssinatura;
    if (usaBiometria) {
      const cpf = (
        s.transporteSolicitacao?.cpfMotorista?.trim() ||
        s.portaria?.motoristaCpf ||
        ''
      ).replace(/\D/g, '');
      if (cpf.length !== 11) {
        throw new BadRequestException('CPF do motorista é obrigatório para assinar com digital.');
      }
      const bio = await this.biometria.status(s.tenantId ?? DEFAULT_TENANT_ID, cpf);
      if (!bio.enrolled) {
        throw new BadRequestException(
          'Motorista sem digital cadastrada. Cadastre no leitor ou use assinatura no papel.',
        );
      }
      assinatura = ASSINATURA_BIOMETRIA_OK;
    }
    if (modo === 'DIGITAL' && !assinatura) {
      throw new BadRequestException('Assinatura do motorista é obrigatória no modo digital');
    }
    await this.prisma.gate.upsert({
      where: { solicitacaoId: s.id },
      create: { solicitacaoId: s.id, ricAssinado: false },
      update: {},
    });
    const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
    const to: OperacaoState = state === 'RIC_GERADO' ? 'RIC_GERADO' : 'RIC_GERADO';
    const patch: Partial<OperacaoFluxoJson> = {
      assinatura,
      assinaturaModo: modo,
      assinaturaOperadorId: actorUserId,
      ricGeradoEm: fluxo.ricGeradoEm ?? new Date().toISOString(),
      ...(usaBiometria
        ? {
            assinaturaBiometria: {
              cpf: (
                s.transporteSolicitacao?.cpfMotorista?.trim() ||
                s.portaria?.motoristaCpf ||
                ''
              ).replace(/\D/g, ''),
              verificadoEm: new Date().toISOString(),
              matched: true as const,
            },
          }
        : {}),
    };
    const updated =
      state === 'RIC_GERADO'
        ? await this.prisma.solicitacao.update({
            where: { id: s.id },
            data: {
              operacaoFluxoJson: {
                ...fluxo,
                ...patch,
              } as Prisma.InputJsonValue,
            },
            include: SOLICITACAO_INCLUDE,
          })
        : await this.transition(s, to, { ...patch, ricGeradoEm: new Date().toISOString() }, actorUserId);
    await this.prisma.gate.update({
      where: { solicitacaoId: s.id },
      data: { ricAssinado: true },
    });
    await this.unidadeProcesso.ensureIdNaEmissaoRic(updated.id, actorUserId);
    const cRic = updated.containersSolicitacao[0];
    const fluxoRic = this.parseFluxoJson(updated.operacaoFluxoJson);
    void this.catalogoContainers
      .registrarDaOperacao({
        unidadeIso: this.containerNumero(updated),
        tipoCodigo: cRic?.tipo,
        tamanho: cRic?.tamanho,
        fotos: fluxoRic.vistoria?.fotos as never,
      })
      .catch((err) =>
        this.logger.warn(`Catálogo da caixa não atualizou: ${(err as Error).message}`),
      );
    return this.toOperacaoDto(await this.findByProtocolo(updated.protocolo));
  }

  async buildRicData(protocolo: string, actorUserId?: string): Promise<RICData> {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    const estadosValidos: OperacaoState[] = [
      'RECONFIRMADA',
      'RIC_GERADO',
      'LIBERADA_OPERACAO',
      'EM_OPERACAO',
      'CONCLUIDA',
    ];
    if (!estadosValidos.includes(state)) {
      throw new BadRequestException(
        `RIC só pode ser gerado após reconfirmação. Estado atual: ${STATE_LABELS[state]}`,
      );
    }

    const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
    const t = s.transporteSolicitacao;
    const c = s.containersSolicitacao[0];

    let reconfirmacaoNome = '—';
    const operadorId = fluxo.reconfirmacao?.operadorId;
    if (operadorId) {
      const u = await this.prisma.user.findUnique({
        where: { id: operadorId },
        select: { email: true },
      });
      reconfirmacaoNome = u?.email ?? operadorId;
    }

    const operadorAssinaturaId =
      fluxo.assinaturaOperadorId ?? actorUserId ?? fluxo.reconfirmacao?.operadorId;
    const operadorAssinatura = await this.resolveOperadorAssinatura(operadorAssinaturaId);

    const [logoPng, branding] = await Promise.all([
      this.empresa.logoPngBuffer(s.tenantId || DEFAULT_TENANT_ID, 'documento'),
      this.empresa.brandingPublico(s.tenantId || DEFAULT_TENANT_ID),
    ]);

    const tipoOp = String(s.tipoOperacao ?? '');
    const direcao = direcaoUnidade(tipoOp);
    const processoRow =
      (direcao === 'SAIDA'
        ? (s.unidadeProcessosSaida?.[0] ?? s.unidadeProcessosEntrada?.[0] ?? null)
        : (s.unidadeProcessosEntrada?.[0] ?? s.unidadeProcessosSaida?.[0] ?? null)) ??
      (await this.unidadeProcesso.findAbertoPorIso(this.containerNumero(s), this.prisma, {
        clienteId: s.clienteId,
      }));
    const ocrIndicativo = this.ocrIndicativoTipo(
      (fluxo.vistoria?.fotos ?? []) as never,
      c?.tipo,
      c?.tamanho,
    );
    const dataRef = s.agendamentoSolicitacao?.dataRef;
    const turno = s.agendamentoSolicitacao?.turno?.trim();
    const agendamento = dataRef
      ? `${dataRef.toLocaleDateString('pt-BR')}${turno ? ` - ${turno}` : ''}`
      : '—';
    const observacaoSeparada = separarObservacaoLivreEEfeitos(
      fluxo.observacaoGate,
      fluxo.observacoesEfeito,
    );

    return {
      protocolo: s.protocolo,
      containerNumero: this.containerNumero(s),
      containerTipo: c?.tipo ? resolveTipoContainerCodigo(c.tipo) : '—',
      containerTamanho: c?.tamanho ? formatTamanhoContainerMatrix(c.tamanho) : '—',
      containerSituacao: c?.status ?? '—',
      tipoOperacao: rotuloTipoOperacao(tipoOp),
      placa: t?.placaCavalo?.trim() || s.portaria?.placaVeiculo || '—',
      placaCavalo: t?.placaCavalo?.trim() || s.portaria?.placaVeiculo || '—',
      placaCarreta: t?.placaCarreta01?.trim() || '—',
      placaCarreta02: t?.placaCarreta02?.trim() || '',
      motoristaNome: t?.nomeMotorista?.trim() || s.portaria?.motoristaNome || '—',
      motoristaCPF: t?.cpfMotorista?.trim() || s.portaria?.motoristaCpf || '',
      transportadoraNome: transportadoraDoDossie(s).nome || undefined,
      transportadoraCNPJ: transportadoraDoDossie(s).cnpj || undefined,
      clienteNome: s.cliente.nomeFantasia || s.cliente.razaoSocial,
      clienteCNPJ: s.cliente.cpfCnpj ?? '',
      lacre:
        lacreRic(
          direcao === 'SAIDA' ? 'SAIDA' : 'ENTRADA',
          c?.lacre,
          processoRow?.lacreSaida,
        ) || '—',
      booking: c?.booking?.trim() || '—',
      processo: c?.processo?.trim() || '—',
      navio: c?.navio?.trim() || '—',
      agendamento,
      caminhao: rotuloTipoCaminhao(t?.tipoCaminhao ? String(t.tipoCaminhao) : ''),
      checkin: s.portaria?.createdAt
        ? s.portaria.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : '—',
      unidadeProcesso: processoRow ? formatUnidadeProcessoId(processoRow.numero) : '—',
      direcao: rotuloDirecaoUnidade(direcao),
      vistoria: {
        fotos: fluxo.vistoria?.fotos ?? [],
        avarias: fluxo.vistoria?.avarias ?? [],
        dataVistoria: fluxo.vistoria?.enviadaEm ?? s.updatedAt.toISOString(),
        portariaResponsavel: 'Portaria RL',
      },
      reconfirmacao: {
        responsavel: reconfirmacaoNome,
        dataReconfirmacao: fluxo.reconfirmacao?.reconfirmadaEm ?? '—',
        checklist: fluxo.reconfirmacao?.checklist ?? {},
      },
      assinatura: fluxo.assinatura ?? '',
      assinaturaModo: fluxo.assinaturaModo === 'MANUAL' ? 'MANUAL' : 'DIGITAL',
      dataAssinatura: fluxo.ricGeradoEm ?? new Date().toISOString(),
      qrToken: fluxo.qrToken ?? '',
      observacaoGate: composeObservacao(
        observacaoSeparada.livre,
        observacaoSeparada.efeitos,
        direcao === 'SAIDA' ? processoRow?.lacreSaidaObservacao : '',
      ),
      operadorNome: operadorAssinatura.nome,
      operadorCPF: operadorAssinatura.cpf,
      logoPng: logoPng ?? undefined,
      empresaNome: branding.nome,
      ocrPorta: ocrIndicativo
        ? {
            tipoIso: ocrIndicativo.tipoIso || undefined,
            rotulo: ocrIndicativo.rotulo || undefined,
            mgwKg: ocrIndicativo.mgwKg,
            taraKg: ocrIndicativo.taraKg,
            payloadKg: ocrIndicativo.payloadKg,
            owner: ocrIndicativo.owner,
            status: ocrIndicativo.status,
            cadastroLabel: ocrIndicativo.cadastroLabel || undefined,
          }
        : undefined,
    };
  }

  private async resolveOperadorAssinatura(
    userId?: string,
  ): Promise<{ nome: string; cpf: string }> {
    if (!userId) return { nome: 'Operador do Gate', cpf: '' };
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, cpfCnpj: true, tenantId: true },
    });
    if (!u) return { nome: 'Operador do Gate', cpf: '' };
    const cpf = u.cpfCnpj.replace(/\D/g, '').slice(-11);
    const colaborador = cpf
      ? await this.prisma.cadastroColaborador.findFirst({
          where: { tenantId: u.tenantId, cpf, deletedAt: null },
          select: { nome: true },
        })
      : null;
    const nome = colaborador?.nome?.trim() || u.email || 'Operador do Gate';
    return { nome, cpf };
  }

  async streamRicPdf(
    protocolo: string,
    actorUserId?: string,
    modelo?: string,
  ): Promise<PassThrough> {
    const data = await this.buildRicData(protocolo, actorUserId);
    const m = (modelo ?? '').trim().toLowerCase();
    if (m === 'dupla') {
      return generateRicPdfA4Dupla(data);
    }
    if (m === 'cupom') {
      if (!usaRicTermica80(data)) {
        throw new BadRequestException(
          'O cupom térmico só é emitido quando a RIC foi assinada com impressão digital.',
        );
      }
      return generateRicPdfTermica80(data);
    }
    if (m === 'completa') {
      return generateRICPDF(data, { forcarCompleta: true });
    }
    return generateRICPDF(data);
  }

  async liberarOperacao(protocolo: string, actorUserId: string) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'RIC_GERADO') {
      throw new BadRequestException('Liberação permitida após RIC gerado');
    }
    if (!canTransition(state, 'LIBERADA_OPERACAO')) {
      throw new BadRequestException(
        `Transição inválida: ${STATE_LABELS[state]} → ${STATE_LABELS.LIBERADA_OPERACAO}`,
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const from = this.inferState(s);
      const prevJson = this.parseFluxoJson(s.operacaoFluxoJson);
      const next = await tx.solicitacao.update({
        where: { id: s.id },
        data: {
          operacaoFluxoEstado: 'LIBERADA_OPERACAO',
          operacaoFluxoJson: prevJson as Prisma.InputJsonValue,
          status: StatusSolicitacao.EM_PATIO,
        },
        include: SOLICITACAO_INCLUDE,
      });
      await this.auditoria.registrar(
        {
          tabela: 'solicitacoes',
          registroId: s.id,
          acao: AcaoAuditoria.UPDATE,
          usuario: actorUserId,
          solicitacaoId: s.id,
          dadosAntes: { operacaoFluxoEstado: from },
          dadosDepois: { operacaoFluxoEstado: 'LIBERADA_OPERACAO' },
        },
        tx,
      );
      await this.unidadeProcesso.onLiberarOperacao(s.id, actorUserId, tx);
      return next;
    });
    return this.toOperacaoDto(await this.findByProtocolo(updated.protocolo));
  }

  async iniciarOperacao(protocolo: string, equipamentoId: string | undefined, actorUserId: string) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'LIBERADA_OPERACAO') {
      throw new BadRequestException('Início permitido quando liberada para operação');
    }
    const updated = await this.transition(
      s,
      'EM_OPERACAO',
      { tatInicio: new Date().toISOString(), equipamentoId },
      actorUserId,
    );
    return this.toOperacaoDto(updated);
  }

  async concluirOperacao(protocolo: string, actorUserId: string) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'EM_OPERACAO') {
      throw new BadRequestException('Conclusão permitida apenas em operação');
    }
    const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
    const updated = await this.transition(
      s,
      'CONCLUIDA',
      { ...fluxo, tatFim: new Date().toISOString() },
      actorUserId,
      { status: StatusSolicitacao.CONCLUIDO },
    );
    return this.toOperacaoDto(updated);
  }

  async countAguardandoReconfirmacao(): Promise<number> {
    return this.prisma.solicitacao.count({
      where: { deletedAt: null, operacaoFluxoEstado: 'AGUARDANDO_RECONFIRMACAO' },
    });
  }

  async listAguardandoReconfirmacao() {
    const rows = await this.prisma.solicitacao.findMany({
      where: { deletedAt: null, operacaoFluxoEstado: 'AGUARDANDO_RECONFIRMACAO' },
      include: SOLICITACAO_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return { items: rows.map((s) => this.mapOperacaoDto(s, { compact: true })) };
  }

  async countControleEntradaSaida() {
    const [aConferir, ricPendente, prontoSaida] = await Promise.all([
      this.prisma.solicitacao.count({
        where: { deletedAt: null, operacaoFluxoEstado: 'AGUARDANDO_RECONFIRMACAO' },
      }),
      this.prisma.solicitacao.count({
        where: {
          deletedAt: null,
          operacaoFluxoEstado: { in: ['RECONFIRMADA', 'RIC_GERADO'] },
        },
      }),
      this.prisma.solicitacao.count({
        where: { deletedAt: null, status: StatusSolicitacao.AGUARDANDO_GATE_OUT },
      }),
    ]);
    return { count: aConferir + ricPendente + prontoSaida, aConferir, ricPendente, prontoSaida };
  }

  async listControleEntradaSaida() {
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    const rows = await this.prisma.solicitacao.findMany({
      where: {
        deletedAt: null,
        OR: [
          {
            operacaoFluxoEstado: {
              in: [
                'CHECKIN_PORTARIA',
                'VISTORIA_FOTOGRAFICA',
                'AGUARDANDO_RECONFIRMACAO',
                'RECONFIRMADA',
                'RIC_GERADO',
              ],
            },
          },
          {
            operacaoFluxoEstado: 'LIBERADA_OPERACAO',
            updatedAt: { gte: inicioHoje },
          },
          { status: StatusSolicitacao.AGUARDANDO_GATE_OUT },
        ],
      },
      include: SOLICITACAO_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: 150,
    });
    return {
      items: rows
        .map((s) => this.mapOperacaoDto(s, { compact: true }))
        .filter((item) => item.coluna != null),
      ...(await this.countControleEntradaSaida()),
    };
  }

  async validateQrToken(token: string) {
    const rows = await this.prisma.solicitacao.findMany({
      where: {
        deletedAt: null,
        operacaoFluxoEstado: { in: ['AGUARDANDO_CHEGADA', 'APROVADA'] },
      },
      include: SOLICITACAO_INCLUDE,
      take: 500,
    });
    for (const s of rows) {
      const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
      if (fluxo.qrToken !== token) continue;
      if (!qrEstaAtivo(fluxo)) {
        throw new BadRequestException(
          fluxo.qrAtivo === false ? 'QR Code aguardando aprovação no Gate' : 'QR Code expirado',
        );
      }
      return this.toOperacaoDto(s);
    }
    throw new NotFoundException('QR Code inválido');
  }

  /** Gera/reativa o QR na aprovação — reutiliza o token se já existir. */
  buildQrOnApproval(
    existingJson: OperacaoFluxoJson,
    protocolo: string,
    clienteId: string,
    container: string,
    validadeHoras?: number,
  ) {
    return buildQrOnApproval(existingJson, protocolo, clienteId, container, validadeHoras);
  }

  async portariaStats() {
    const [aguardandoChegada, emVistoria, aguardandoGate, concluidasHoje] = await Promise.all([
      this.prisma.solicitacao.count({
        where: { deletedAt: null, operacaoFluxoEstado: 'AGUARDANDO_CHEGADA' },
      }),
      this.prisma.solicitacao.count({
        where: {
          deletedAt: null,
          operacaoFluxoEstado: { in: ['CHECKIN_PORTARIA', 'VISTORIA_FOTOGRAFICA'] },
        },
      }),
      this.prisma.solicitacao.count({
        where: { deletedAt: null, operacaoFluxoEstado: 'AGUARDANDO_RECONFIRMACAO' },
      }),
      this.prisma.solicitacao.count({
        where: {
          deletedAt: null,
          operacaoFluxoEstado: 'CONCLUIDA',
          updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);
    return { aguardandoChegada, emVistoria, aguardandoGate, concluidasHoje };
  }
}
