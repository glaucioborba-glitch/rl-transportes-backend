"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2, Mail, RefreshCw, Save, Send, Settings, Timer, Calendar } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useParametrosGerais } from "@/hooks/use-parametros-gerais";
import { canDo, type CadastrosUserContext } from "@/lib/cadastros/permission-matrix";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import {
  enviarEmailTeste,
  type TenantParametrosOperacional,
  type TenantTurnoOperacionalConfig,
} from "@/lib/api/tenant-config-client";
import {
  ParametrosBreadcrumb,
  ParametrosTabs,
} from "../components/parametros-tabs";
import { TurnoRow } from "./turno-row";
import { FeriadoCalendar } from "./feriado-calendar";

function newTurno(): TenantTurnoOperacionalConfig {
  return {
    id: `t-${Date.now()}`,
    codigo: "T5",
    slot: "MANHA",
    nome: "Novo turno",
    horaInicio: "22:00",
    horaFim: "06:00",
    capacidadeMaxima: 10,
    diasSemana: ["SEG", "TER", "QUA", "QUI", "SEX"],
    ativo: true,
  };
}

export default function ParametrosOperacionalPage() {
  const staffUser = useStaffAuthStore((s) => s.user);
  const user: CadastrosUserContext = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const canEdit = canDo(user, "parametros", "EDIT");

  const { data, loading, error, update, recalcCapacidade } = useParametrosGerais();
  const [form, setForm] = useState<TenantParametrosOperacional | null>(null);
  const [saving, setSaving] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  /** Mantida fora do form: a API nunca devolve a senha salva. */
  const [smtpSenha, setSmtpSenha] = useState("");
  const [testeDestino, setTesteDestino] = useState("");
  const [testando, setTestando] = useState(false);

  useEffect(() => {
    if (data?.operacional) setForm(data.operacional);
  }, [data]);

  if (loading || !form) {
    return (
      <div className="space-y-6">
        <ParametrosBreadcrumb current="Operacional" />
        <ParametrosTabs />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {error ? (
            <span className="text-red-400">Erro ao carregar parâmetros: {error}</span>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando parâmetros operacionais…
            </>
          )}
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    const emailEnvio = form.emailEnvio?.trim().toLowerCase() ?? "";
    if (emailEnvio && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEnvio)) {
      toast.error("Informe um e-mail de envio válido.");
      return;
    }
    const smtpHost = form.emailSmtpHost?.trim() ?? "";
    setSaving(true);
    try {
      const operacional = {
        capacidadeTotalSlots: form.capacidadeTotalSlots,
        teuMaximoSimultaneo: form.teuMaximoSimultaneo,
        horarioFuncionamentoInicio: form.horarioFuncionamentoInicio.slice(0, 5),
        horarioFuncionamentoFim: form.horarioFuncionamentoFim.slice(0, 5),
        freeTimePadraoDias: form.freeTimePadraoDias,
        tatAlvoEntradaMin: form.tatAlvoEntradaMin,
        tatAlvoSaidaMin: form.tatAlvoSaidaMin,
        tatAlvoRemocaoMin: form.tatAlvoRemocaoMin,
        limiteAgendamentosPorTurno: form.limiteAgendamentosPorTurno,
        operacaoFimSemana: form.operacaoFimSemana,
        ...(form.descricaoFimSemana != null
          ? { descricaoFimSemana: form.descricaoFimSemana }
          : {}),
        toleranciaChegada: form.toleranciaChegada,
        antecedenciaMinimaMin: form.antecedenciaMinimaMin,
        cancelamentoSemPenalidadeMin: form.cancelamentoSemPenalidadeMin,
        validarAntecedenciaAgendamento: form.validarAntecedenciaAgendamento,
        validarCancelamentoSemPenalidade: form.validarCancelamentoSemPenalidade,
        qrValidadeHoras: Math.min(168, Math.max(1, Math.round(Number(form.qrValidadeHoras) || 24))),
        emailEnvio,
        emailEnvioNome: form.emailEnvioNome?.trim() ?? "",
        emailSmtpHost: smtpHost,
        emailSmtpPorta: Math.min(65535, Math.max(1, Math.round(Number(form.emailSmtpPorta) || 587))),
        emailSmtpUsuario: form.emailSmtpUsuario?.trim() ?? "",
        // Senha em branco mantém a que está salva. Sem servidor, apaga a senha guardada.
        ...(smtpSenha ? { emailSmtpSenha: smtpSenha } : smtpHost ? {} : { emailSmtpSenha: "" }),
        turnos: form.turnos.map((t) => ({
          id: t.id,
          slot: t.slot ?? "MANHA",
          codigo: t.codigo.trim().slice(0, 32),
          nome: t.nome.trim(),
          horaInicio: t.horaInicio.slice(0, 5),
          horaFim: t.horaFim.slice(0, 5),
          capacidadeMaxima: Math.round(Number(t.capacidadeMaxima) || 1),
          diasSemana: t.diasSemana,
          ativo: t.ativo,
        })),
        feriadosMunicipais: form.feriadosMunicipais ?? [],
      };
      await update({ operacional });
      setSmtpSenha("");
      toast.success("Parâmetros operacionais salvos.");
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Erro ao salvar parâmetros operacionais.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEnviarTeste = async () => {
    const destino = testeDestino.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
      toast.error("Informe um destinatário válido para o teste.");
      return;
    }
    setTestando(true);
    try {
      const r = await enviarEmailTeste(destino);
      if (r.enviado) {
        toast.success(
          `${r.mensagem} Remetente: ${r.from}${r.origem === "env" ? " (SMTP do servidor)" : ""}`,
        );
      } else {
        toast.error(r.mensagem);
      }
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Erro ao enviar e-mail de teste.",
      );
    } finally {
      setTestando(false);
    }
  };

  const handleRecalcularCapacidade = async () => {
    setRecalculando(true);
    try {
      const { capacidadeCalculada } = await recalcCapacidade();
      toast.success(`Capacidade recalculada: ${capacidadeCalculada} posições ativas`);
      if (
        window.confirm(
          `Deseja atualizar o campo "Capacidade total" para ${capacidadeCalculada}?`,
        )
      ) {
        setForm({ ...form, capacidadeTotalSlots: capacidadeCalculada });
      }
    } catch {
      toast.error("Erro ao recalcular capacidade.");
    } finally {
      setRecalculando(false);
    }
  };

  const updateTurno = (index: number, field: keyof TenantTurnoOperacionalConfig, value: unknown) => {
    const turnos = [...form.turnos];
    turnos[index] = { ...turnos[index], [field]: value };
    setForm({ ...form, turnos });
  };

  const removeTurno = (index: number) => {
    setForm({ ...form, turnos: form.turnos.filter((_, i) => i !== index) });
  };

  const addTurno = () => {
    setForm({ ...form, turnos: [...form.turnos, newTurno()] });
  };

  return (
    <div className="space-y-6">
      <ParametrosBreadcrumb current="Operacional" />
      <div>
        <h1 className="text-2xl font-bold">Parâmetros Gerais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configuração centralizada do terminal — capacidade, turnos, feriados, TAT, agendamentos e e-mail de envio.
        </p>
      </div>
      <ParametrosTabs />

      <FormSection title="E-mail de envio do sistema" icon={Mail}>
        <p className="mb-4 text-sm text-muted-foreground">
          Remetente e servidor de saída de todas as mensagens automáticas: recuperação de senha,
          cobrança, alerta de cadastro e demais e-mails do terminal. Cada terminal tem a sua conta.
          Sem servidor preenchido aqui, vale o SMTP do ambiente.
        </p>
        <div className="flex flex-wrap gap-4">
          <FormField label="Nome de exibição" className="min-w-[14rem] flex-1">
            <Input
              disabled={!canEdit}
              value={form.emailEnvioNome ?? ""}
              onChange={(e) => setForm({ ...form, emailEnvioNome: e.target.value })}
              placeholder="RL Transportes"
              maxLength={120}
            />
          </FormField>
          <FormField label="E-mail remetente" className="min-w-[16rem] flex-1">
            <Input
              type="email"
              disabled={!canEdit}
              value={form.emailEnvio ?? ""}
              onChange={(e) => setForm({ ...form, emailEnvio: e.target.value })}
              placeholder="nao-responder@rl.com.br"
              maxLength={255}
            />
          </FormField>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <FormField label="Servidor SMTP" className="min-w-[16rem] flex-1">
            <Input
              disabled={!canEdit}
              value={form.emailSmtpHost ?? ""}
              onChange={(e) => setForm({ ...form, emailSmtpHost: e.target.value })}
              placeholder="smtp.seuprovedor.com.br"
              maxLength={255}
            />
          </FormField>
          <FormField label="Porta" className="w-28">
            <Input
              type="number"
              min={1}
              max={65535}
              disabled={!canEdit}
              value={form.emailSmtpPorta ?? 587}
              onChange={(e) =>
                setForm({ ...form, emailSmtpPorta: Number(e.target.value) || 587 })
              }
            />
            <p className="mt-1 text-[10px] text-zinc-500">465 = SSL · 587 = TLS</p>
          </FormField>
          <FormField label="Usuário" className="min-w-[14rem] flex-1">
            <Input
              disabled={!canEdit}
              value={form.emailSmtpUsuario ?? ""}
              onChange={(e) => setForm({ ...form, emailSmtpUsuario: e.target.value })}
              placeholder="nao-responder@rl.com.br"
              maxLength={255}
              autoComplete="off"
            />
          </FormField>
          <FormField label="Senha" className="min-w-[14rem] flex-1">
            <Input
              type="password"
              disabled={!canEdit}
              value={smtpSenha}
              onChange={(e) => setSmtpSenha(e.target.value)}
              placeholder={form.emailSmtpSenhaDefinida ? "•••••••• (salva)" : "senha da conta"}
              maxLength={255}
              autoComplete="new-password"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              {form.emailSmtpSenhaDefinida
                ? "Em branco mantém a senha salva. Limpar o servidor apaga a senha."
                : "A senha fica só no servidor e nunca é exibida de volta."}
            </p>
          </FormField>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <FormField label="Enviar e-mail de teste para" className="min-w-[16rem] flex-1">
            <Input
              type="email"
              disabled={!canEdit}
              value={testeDestino}
              onChange={(e) => setTesteDestino(e.target.value)}
              placeholder="voce@empresa.com.br"
              maxLength={255}
            />
          </FormField>
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit || testando}
            onClick={() => void handleEnviarTeste()}
          >
            {testando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar teste
              </>
            )}
          </Button>
          <p className="w-full text-[11px] text-zinc-500">
            O teste usa o que está salvo. Salve os parâmetros antes de testar.
          </p>
        </div>
      </FormSection>

      <FormSection title="Capacidade e Horário" icon={Settings}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Capacidade total (slots)" required>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={5000}
                disabled={!canEdit}
                value={form.capacidadeTotalSlots}
                onChange={(e) =>
                  setForm({ ...form, capacidadeTotalSlots: Number(e.target.value) || 1 })
                }
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canEdit || recalculando}
                title="Recalcular a partir das posições de pátio"
                onClick={() => void handleRecalcularCapacidade()}
              >
                {recalculando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </FormField>
          <FormField label="TEU máximo simultâneo">
            <Input
              type="number"
              min={1}
              max={2000}
              disabled={!canEdit}
              value={form.teuMaximoSimultaneo}
              onChange={(e) =>
                setForm({ ...form, teuMaximoSimultaneo: Number(e.target.value) || 1 })
              }
              placeholder="280 slots × 2 TEU = 560 TEU"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              1 contêiner 20&apos; = 1 TEU · 1 contêiner 40&apos; = 2 TEU
            </p>
          </FormField>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <FormField label="Horário de abertura" required>
            <Input
              type="time"
              disabled={!canEdit}
              value={form.horarioFuncionamentoInicio}
              onChange={(e) => setForm({ ...form, horarioFuncionamentoInicio: e.target.value })}
            />
          </FormField>
          <FormField label="Horário de fechamento" required>
            <Input
              type="time"
              disabled={!canEdit}
              value={form.horarioFuncionamentoFim}
              onChange={(e) => setForm({ ...form, horarioFuncionamentoFim: e.target.value })}
            />
          </FormField>
        </div>
        <FormField label="Operação aos finais de semana">
          <Switch
            checked={form.operacaoFimSemana}
            disabled={!canEdit}
            onCheckedChange={(v) => setForm({ ...form, operacaoFimSemana: v })}
          />
        </FormField>
      </FormSection>

      <FormSection title="Turnos Operacionais" icon={Clock}>
        <p className="mb-3 text-sm text-muted-foreground">
          A equipe cadastra e ajusta turnos em{" "}
          <a href="/rh/jornada/turnos" className="text-[var(--accent)] hover:underline">
            RH → Turnos
          </a>
          . É a mesma lista usada no cadastro do colaborador e no Gate.
        </p>
        <div className="space-y-3">
          {form.turnos.map((turno, index) => (
            <TurnoRow
              key={turno.id || index}
              turno={turno}
              index={index}
              disabled={!canEdit}
              onChange={updateTurno}
              onRemove={removeTurno}
            />
          ))}
          {canEdit ? (
            <Button type="button" variant="outline" onClick={addTurno} className="w-full border-dashed">
              + Adicionar turno
            </Button>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Feriados" icon={Calendar}>
        <FeriadoCalendar disabled={!canEdit} />
      </FormSection>

      <FormSection title="Free Time e TAT" icon={Timer}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Free time padrão (dias)" required>
            <Input
              type="number"
              min={0}
              max={90}
              disabled={!canEdit}
              value={form.freeTimePadraoDias}
              onChange={(e) => setForm({ ...form, freeTimePadraoDias: Number(e.target.value) })}
            />
          </FormField>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <FormField label="TAT alvo — Entrada (min)">
            <Input
              type="number"
              min={15}
              max={4320}
              disabled={!canEdit}
              value={form.tatAlvoEntradaMin}
              onChange={(e) => setForm({ ...form, tatAlvoEntradaMin: Number(e.target.value) })}
            />
          </FormField>
          <FormField label="TAT alvo — Saída (min)">
            <Input
              type="number"
              min={15}
              max={4320}
              disabled={!canEdit}
              value={form.tatAlvoSaidaMin}
              onChange={(e) => setForm({ ...form, tatAlvoSaidaMin: Number(e.target.value) })}
            />
          </FormField>
          <FormField label="TAT alvo — Remoção (min)">
            <Input
              type="number"
              min={15}
              max={4320}
              disabled={!canEdit}
              value={form.tatAlvoRemocaoMin}
              onChange={(e) =>
                setForm({ ...form, tatAlvoRemocaoMin: Number(e.target.value) })
              }
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Tolerância de chegada" icon={Timer}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Tipo">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={!canEdit}
              value={form.toleranciaChegada.tipo}
              onChange={(e) =>
                setForm({
                  ...form,
                  toleranciaChegada: {
                    ...form.toleranciaChegada,
                    tipo: e.target.value as "dia" | "turno" | "horario",
                  },
                })
              }
            >
              <option value="dia">Dia</option>
              <option value="turno">Turno</option>
              <option value="horario">Horário</option>
            </select>
          </FormField>
          <FormField label="Valor (min)">
            <Input
              type="number"
              min={0}
              max={10080}
              disabled={!canEdit || !form.toleranciaChegada.ativo}
              value={form.toleranciaChegada.valorMin}
              onChange={(e) =>
                setForm({
                  ...form,
                  toleranciaChegada: {
                    ...form.toleranciaChegada,
                    valorMin: Number(e.target.value),
                  },
                })
              }
            />
          </FormField>
          <FormField label="Ativo">
            <Switch
              checked={form.toleranciaChegada.ativo}
              disabled={!canEdit}
              onCheckedChange={(v) =>
                setForm({
                  ...form,
                  toleranciaChegada: { ...form.toleranciaChegada, ativo: v },
                })
              }
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Agendamentos" icon={Calendar}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Limite de agendamentos por turno (legado)" required>
            <Input
              type="number"
              min={1}
              max={100}
              disabled={!canEdit}
              value={form.limiteAgendamentosPorTurno}
              onChange={(e) =>
                setForm({ ...form, limiteAgendamentosPorTurno: Number(e.target.value) || 1 })
              }
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Capacidade efetiva vem de cada turno operacional acima.
            </p>
          </FormField>
          <FormField label="Antecedência mínima (min)" required>
            <Input
              type="number"
              min={0}
              max={10080}
              disabled={!canEdit || !form.validarAntecedenciaAgendamento}
              value={form.antecedenciaMinimaMin}
              onChange={(e) =>
                setForm({ ...form, antecedenciaMinimaMin: Number(e.target.value) || 0 })
              }
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Tempo mínimo entre a criação do agendamento e a data agendada
            </p>
          </FormField>
          <FormField label="Validar antecedência">
            <Switch
              checked={form.validarAntecedenciaAgendamento}
              disabled={!canEdit}
              onCheckedChange={(v) => setForm({ ...form, validarAntecedenciaAgendamento: v })}
            />
          </FormField>
          <FormField label="Cancelamento sem penalidade (min)" required>
            <Input
              type="number"
              min={0}
              max={10080}
              disabled={!canEdit || !form.validarCancelamentoSemPenalidade}
              value={form.cancelamentoSemPenalidadeMin}
              onChange={(e) =>
                setForm({ ...form, cancelamentoSemPenalidadeMin: Number(e.target.value) || 0 })
              }
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Cancelamentos com menos tempo registram &quot;Cancelamento Tardio&quot; no histórico
            </p>
          </FormField>
          <FormField label="Validar cancelamento">
            <Switch
              checked={form.validarCancelamentoSemPenalidade}
              disabled={!canEdit}
              onCheckedChange={(v) => setForm({ ...form, validarCancelamentoSemPenalidade: v })}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="QR Code de acesso" icon={Timer}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Validade após aprovação (horas)" required>
            <Input
              type="number"
              min={1}
              max={168}
              disabled={!canEdit}
              value={form.qrValidadeHoras ?? 24}
              onChange={(e) =>
                setForm({ ...form, qrValidadeHoras: Math.max(1, Number(e.target.value) || 24) })
              }
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Um único QR (portal do cliente e portaria). Só vale depois da aprovação no Gate.
              Se o cliente alterar motorista, placas ou agenda, volta para Autorizações; o QR
              impresso continua o mesmo e é reativado na nova aprovação. De 1 a 168 horas (7 dias).
            </p>
          </FormField>
        </div>
      </FormSection>

      {canEdit ? (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setForm(data?.operacional ?? form)}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar parâmetros
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
