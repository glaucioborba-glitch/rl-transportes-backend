"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { FaixasDiariaEditor, type FaixaDiariaForm } from "./faixas-diaria-editor";

export type MatrixItemForm = {
  categoriaItem: "ARMAZENAGEM";
  tipoOperacaoCodigo: "ARMAZENAGEM";
  tipoContainerCodigo: string;
  capacidadeCodigo: string;
  containerTamanho: string;
  statusContainer: string;
  valorHandling: string;
  freeTimeDias: string;
  faixasDiaria: FaixaDiariaForm[];
  faixasEnergiaReefer: FaixaDiariaForm[];
  tarifaEnergiaReeferDiaria: string;
  valor: number;
  unidade: string;
};

type Props = {
  items: MatrixItemForm[];
  onChange: (items: MatrixItemForm[]) => void;
};

function cellKey(item: MatrixItemForm) {
  return [item.tipoContainerCodigo, item.capacidadeCodigo, item.containerTamanho, item.statusContainer].join("|");
}

export function TabelaPrecoMatrixGrid({ items, onChange }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const update = (index: number, patch: Partial<MatrixItemForm>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Use &quot;Gerar combinações MDM&quot; para montar linhas a partir dos tipos e tamanhos
        cadastrados em Tipos de Contêiner (Tipo × Tamanho × Status).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-2 py-2 text-left">Tipo</th>
            <th className="px-2 py-2 text-left">Cap.</th>
            <th className="px-2 py-2 text-left">Tam.</th>
            <th className="px-2 py-2 text-left">Status</th>
            <th className="px-2 py-2 text-left">Handling</th>
            <th className="px-2 py-2 text-left">Free (dias)</th>
            <th className="px-2 py-2 text-left">Faixas</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const key = cellKey(item);
            const isOpen = expanded === key;
            return (
              <>
                <tr key={key} className="border-t border-border hover:bg-muted/30">
                  <td className="px-2 py-1">{item.tipoContainerCodigo}</td>
                  <td className="px-2 py-1">{item.capacidadeCodigo || "—"}</td>
                  <td className="px-2 py-1">{item.containerTamanho}</td>
                  <td className="px-2 py-1">{item.statusContainer}</td>
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
                      value={item.freeTimeDias}
                      onChange={(e) => update(index, { freeTimeDias: e.target.value })}
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
                </tr>
                {isOpen && (
                  <tr key={`${key}-faixas`} className="border-t border-border bg-muted/20">
                    <td colSpan={7} className="p-3">
                      <FaixasDiariaEditor
                        faixas={item.faixasDiaria}
                        freeTimeDias={item.freeTimeDias}
                        onChange={(faixasDiaria) => update(index, { faixasDiaria })}
                      />
                      {(item.tipoContainerCodigo.toUpperCase().includes("REEFER") ||
                        item.faixasEnergiaReefer.length > 0 ||
                        item.tarifaEnergiaReeferDiaria !== "") && (
                        <div className="mt-3">
                          <FaixasDiariaEditor
                            title="Faixas de energia (dias conectados à tomada)"
                            emptyHint="Nenhuma faixa — energia não é cobrada. Dia 1 = primeiro dia ligado."
                            defaultStartDay={1}
                            defaultValor={item.tarifaEnergiaReeferDiaria || "45"}
                            faixas={item.faixasEnergiaReefer}
                            onChange={(faixasEnergiaReefer) => update(index, { faixasEnergiaReefer })}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
