"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Save, X } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroTurno,
  getCadastroTurno,
  updateCadastroTurno,
  type CadastroTurno,
} from "@/lib/api/cadastros-turnos-client";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

const DIAS_SEMANA = [
  { value: "SEG", label: "Seg" },
  { value: "TER", label: "Ter" },
  { value: "QUA", label: "Qua" },
  { value: "QUI", label: "Qui" },
  { value: "SEX", label: "Sex" },
  { value: "SAB", label: "Sáb" },
  { value: "DOM", label: "Dom" },
] as const;

const EMPTY_FORM: Omit<CadastroTurno, "id"> = {
  codigo: "",
  nome: "",
  horaInicio: "06:00",
  horaFim: "14:00",
  capacidadeMaxima: null,
  diasSemana: ["SEG", "TER", "QUA", "QUI", "SEX"],
  ativo: true,
};

type Props = {
  turnoId?: string;
};

export function TurnoForm({ turnoId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(turnoId));
  const [formData, setFormData] = useState<Omit<CadastroTurno, "id">>(EMPTY_FORM);

  useEffect(() => {
    if (!turnoId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastroTurno(turnoId);
        if (on) setFormData(data);
      } catch {
        toast.error("Erro ao carregar turno.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [turnoId]);

  const toggleDia = (dia: string) => {
    setFormData((prev) => {
      const selected = prev.diasSemana.includes(dia);
      return {
        ...prev,
        diasSemana: selected
          ? prev.diasSemana.filter((d) => d !== dia)
          : [...prev.diasSemana, dia],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigo || !formData.nome || !formData.horaInicio || !formData.horaFim) {
      toast.error("Código, Nome e horários são obrigatórios.");
      return;
    }
    if (formData.diasSemana.length === 0) {
      toast.error("Selecione ao menos um dia da semana.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        capacidadeMaxima:
          formData.capacidadeMaxima != null && !Number.isNaN(Number(formData.capacidadeMaxima))
            ? Number(formData.capacidadeMaxima)
            : null,
      };
      if (turnoId) {
        await updateCadastroTurno(turnoId, payload);
        toast.success("Turno atualizado!");
      } else {
        await createCadastroTurno(payload);
        toast.success("Turno cadastrado!");
      }
      router.push("/cadastros/operacional/turnos");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      <FormSection title="Turno de Operação" icon={Clock}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Código" required>
            <Input
              value={formData.codigo}
              onChange={(e) =>
                setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
              }
              placeholder="Ex: T1, T2"
              className="font-mono"
            />
          </FormField>
          <FormField label="Nome" required>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Manhã, Tarde, Noite"
            />
          </FormField>
          <FormField label="Hora Início" required>
            <Input
              type="time"
              value={formData.horaInicio}
              onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })}
            />
          </FormField>
          <FormField label="Hora Fim" required>
            <Input
              type="time"
              value={formData.horaFim}
              onChange={(e) => setFormData({ ...formData, horaFim: e.target.value })}
            />
          </FormField>
          <FormField label="Capacidade Máxima">
            <Input
              type="number"
              min={1}
              value={formData.capacidadeMaxima ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  capacidadeMaxima: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="Ex: 5 operações simultâneas"
            />
          </FormField>
          <FormField label="Status">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              Turno ativo
            </label>
          </FormField>
          <FormField label="Dias da Semana" required className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((dia) => {
                const selected = formData.diasSemana.includes(dia.value);
                return (
                  <Button
                    key={dia.value}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleDia(dia.value)}
                    className={cn("min-w-[3rem]", selected && "ring-1 ring-[var(--accent)]")}
                  >
                    {dia.label}
                  </Button>
                );
              })}
            </div>
          </FormField>
        </div>
      </FormSection>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          <X className="mr-2 h-4 w-4" /> Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> {turnoId ? "Atualizar" : "Cadastrar"} Turno
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
