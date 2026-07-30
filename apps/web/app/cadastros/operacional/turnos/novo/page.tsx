import Link from "next/link";
import { TurnoForm } from "../components/turno-form";

export default function NovoTurnoPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/operacional" className="hover:text-white">
            Operacional
          </Link>
          <span>/</span>
          <Link href="/cadastros/operacional/turnos" className="hover:text-white">
            Turnos
          </Link>
          <span>/</span>
          <span>Novo</span>
        </div>
        <h1 className="text-2xl font-bold">Novo Turno</h1>
      </div>
      <TurnoForm />
    </div>
  );
}
