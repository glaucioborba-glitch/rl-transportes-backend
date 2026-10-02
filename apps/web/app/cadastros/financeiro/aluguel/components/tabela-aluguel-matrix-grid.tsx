"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Layers, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import {
  FaixasDiariaEditor,
  type FaixaDiariaForm,
} from "../../tabelas-precos/components/faixas-diaria-editor";

const SELECT_CLASS =
  "flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm";

export type TipoContainerOpcao = {
  codigo: string;
  nome: string;
  tamanhos: string[];
};

export type AluguelMatrixItemForm = {
  tipoContainerCodigo: string;
  containerTamanho: string;
  valorHandling: string;
  diasFreeTime: string;
  faixasDiaria: FaixaDiariaForm[];
};

type Props = {
  items: AluguelMatrixItemForm[];
  tipos: TipoContainerOpcao[];
  onChange: (items: AluguelMatrixItemForm[]) => void;
};

export function formatTamanhoOpcao(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits ? `${digits}'` : raw.trim();
}

function cellKey(item: AluguelMatrixItemForm, index: number) {
  return `${item.tipoContainerCodigo}|${item.containerTamanho}|${index}`;
}

function tamanhosDoTipo(tipos: TipoContainerOpcao[], codigo: string): string[] {
  const tipo = tipos.find((t) => t.codigo === codigo);
  const list = tipo?.tamanhos.length ? tipo.tamanhos : ["20", "40"];
  return list.map(formatTamanhoOpcao);
}

export function TabelaAluguelMatrixGrid({ items, tipos, onChange }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const update = (index: number, patch: Partial<AluguelMatrixItemForm>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Escolha o tipo e o tamanho cadastrados e adicione a linha.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-2 py-2 text-left">Tipo</th>
            <th className="px-2 py-2 text-left">Tam.</th>
            <th className="px-2 py-2 text-left">Handling</th>
            <th className="px-2 py-2 text-left">Free (dias)</th>
            <th className="px-2 py-2 text-left">Faixas</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const key = cellKey(item, index);
            const isOpen = expanded === key;
            const tamanhos = tamanhosDoTipo(tipos, item.tipoContainerCodigo);
            return (
              <Fragment key={key}>
                <tr className="border-t border-border hover:bg-muted/30">
                  <td className="px-2 py-1">
                    <select
                      className={SELECT_CLASS}
                      value={item.tipoContainerCodigo}
                      onChange={(e) => {
                        const codigo = e.target.value;
                        const nextTams = tamanhosDoTipo(tipos, codigo);
                        update(index, {
                          tipoContainerCodigo: codigo,
                          containerTamanho: nextTams.includes(item.containerTamanho)
                            ? item.containerTamanho
                            : (nextTams[0] ?? item.containerTamanho),
                        });
                      }}
                    >
                      {tipos.map((t) => (
                        <option key={t.codigo} value={t.codigo}>
                          {t.codigo} — {t.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className={`${SELECT_CLASS} w-[5.5rem]`}
                      value={item.containerTamanho}
                      onChange={(e) => update(index, { containerTamanho: e.target.value })}
                    >
                      {tamanhos.map((tam) => (
                        <option key={tam} value={tam}>
                          {tam}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <MoneyInput
                      className="h-8 w-28"
                      value={item.valorHandling}
                      onChange={(v) => update(index, { valorHandling: v })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      className="h-8 w-16"
                      type="number"
                      min={0}
                      max={90}
                      value={item.diasFreeTime}
                      onChange={(e) => update(index, { diasFreeTime: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(isOpen ? null : key)}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Layers className="ml-1 h-3 w-3" />
                      {item.faixasDiaria.length}
                    </Button>
                  </td>
                  <td className="px-2 py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onChange(items.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="border-t border-border bg-muted/20">
                    <td colSpan={6} className="p-3">
                      <FaixasDiariaEditor
                        faixas={item.faixasDiaria}
                        freeTimeDias={item.diasFreeTime}
                        emptyHint="Nenhuma faixa — informe as diárias por período (dia início, dia fim, valor/dia)."
                        defaultValor=""
                        onChange={(faixasDiaria) => update(index, { faixasDiaria })}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
