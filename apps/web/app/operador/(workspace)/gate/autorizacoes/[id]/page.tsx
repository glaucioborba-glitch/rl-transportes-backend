import { GateAutorizacaoDetalhePanel } from "@/components/gate/cockpit/gate-autorizacao-detalhe-panel";

export default function GateAutorizacaoDetalhePage({ params }: { params: { id: string } }) {
  return <GateAutorizacaoDetalhePanel id={params.id} />;
}
