import Link from "next/link";
import { EquipamentoForm } from "../components/equipamento-form";

export default function NovoEquipamentoPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/operacional" className="hover:text-white">
            Operacional
          </Link>
          <span>/</span>
          <Link href="/cadastros/operacional/equipamentos" className="hover:text-white">
            Equipamentos
          </Link>
          <span>/</span>
          <span>Novo</span>
        </div>
        <h1 className="text-2xl font-bold">Novo Equipamento</h1>
      </div>
      <EquipamentoForm />
    </div>
  );
}
