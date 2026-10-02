export type TorreControleResponse = {
  financeiro: {
    receitaSerie: { dia: string; provisionada: number; faturada: number }[];
    dsoDias: number;
    faturasAbertasQtd: number;
    faturasAbertasValor: number;
  };
  operacional: {
    tatMedioMinutos: number;
    tatMetaVerde: number;
    tatMetaVermelho: number;
    tatSerie: { dia: string; minutos: number; ciclos: number }[];
    patio: {
      capacidadeTotal: number;
      ocupadas: number;
      livres: number;
      ocupacaoPercent: number;
    };
  };
  tabelas: {
    tatDetalhe: { dia: string; ciclos: number; tatMedioMinutos: number }[];
    faturamentoDiario: { dia: string; provisionada: number; faturada: number }[];
  };
  atualizadoEm: string | null;
};

export type VisaoOperacionalResponse = {
  ocupacaoProjetada: {
    dia: string;
    estoqueAtual: number;
    entradas: number;
    saidas: number;
    projetada: number;
  }[];
  gateHeatmap: { diaSemana: number; diaLabel: string; hora: number; agendamentos: number }[];
  frotaPatio: { status: string; unidades: number }[];
  riscoEscala: {
    data: string;
    turno: string;
    turnoLabel: string;
    cargo: string;
    cargoLabel: string;
    demanda: number;
    capacidade: number;
    escalados: number;
    deficit: number;
    severidade: "OK" | "GARGALO";
    mensagem: string;
  }[];
  tabelas: {
    ocupacao: {
      dia: string;
      estoqueAtual: number;
      entradas: number;
      saidas: number;
      projetada: number;
    }[];
    heatmap: { diaSemana: string; hora: number; agendamentos: number }[];
    frota: { status: string; unidades: number }[];
    riscoEscala: {
      data: string;
      turno: string;
      cargo: string;
      demanda: number;
      capacidade: number;
      deficit: number;
      mensagem: string;
    }[];
  };
  atualizadoEm: string | null;
};
