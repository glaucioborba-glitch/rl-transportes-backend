import { GateAutorizacaoAluguelDetalhePanel } from "@/components/gate/cockpit/gate-autorizacao-aluguel-detalhe-panel";

export default function GateAutorizacaoAluguelDetalhePage({ params }: { params: { id: string } }) {
  return <GateAutorizacaoAluguelDetalhePanel id={params.id} />;
}
