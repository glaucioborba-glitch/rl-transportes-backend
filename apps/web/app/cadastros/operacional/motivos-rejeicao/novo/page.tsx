import Link from "next/link";
import { MotivoRejeicaoForm } from "../components/motivo-rejeicao-form";

export default function NovoMotivoRejeicaoPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/operacional" className="hover:text-white">
            Operacional
          </Link>
          <span>/</span>
          <Link href="/cadastros/operacional/motivos-rejeicao" className="hover:text-white">
            Motivos de Rejeição
          </Link>
          <span>/</span>
          <span>Novo</span>
        </div>
        <h1 className="text-2xl font-bold">Novo Motivo de Rejeição</h1>
      </div>
      <MotivoRejeicaoForm />
    </div>
  );
}
