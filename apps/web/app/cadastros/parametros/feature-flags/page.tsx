"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listAdminFeatureFlags,
  patchAdminFeatureFlag,
  type FeatureFlagRow,
} from "@/lib/api/tenant-config-client";
import { canDo, type CadastrosUserContext } from "@/lib/cadastros/permission-matrix";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { ParametrosBreadcrumb, ParametrosTabs } from "../components/parametros-tabs";

export default function ParametrosFeatureFlagsPage() {
  const staffUser = useStaffAuthStore((s) => s.user);
  const user: CadastrosUserContext = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const canEdit = canDo(user, "parametros", "EDIT");

  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const f = await listAdminFeatureFlags();
      setFlags(f);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar feature flags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleFlag = async (flag: FeatureFlagRow) => {
    if (!canEdit) return;
    try {
      await patchAdminFeatureFlag(flag.chave, { ativo: !flag.ativo });
      toast.success(`Flag ${flag.chave}: ${!flag.ativo ? "ativa" : "inativa"}`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar flag");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <ParametrosBreadcrumb current="Feature Flags" />
      <div>
        <h1 className="text-2xl font-bold">Parâmetros Gerais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toggles de módulos e funcionalidades premium do terminal.
        </p>
      </div>
      <ParametrosTabs />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flag className="h-5 w-5" />
            Feature flags
          </CardTitle>
          <CardDescription>
            Libere módulos por tenant ou CNPJ. Alterações invalidam cache em até 60 segundos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          ) : null}
          {!loading &&
            flags.map((f) => (
              <div
                key={f.chave}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{f.chave}</p>
                  {f.descricao ? <p className="text-xs text-muted-foreground">{f.descricao}</p> : null}
                </div>
                <Button
                  size="sm"
                  variant={f.ativo ? "default" : "outline"}
                  disabled={!canEdit}
                  onClick={() => void toggleFlag(f)}
                >
                  {f.ativo ? "Ativa" : "Inativa"}
                </Button>
              </div>
            ))}
          {!loading && flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma feature flag cadastrada.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
