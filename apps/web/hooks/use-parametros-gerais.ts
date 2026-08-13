"use client";



import { useCallback, useEffect, useState } from "react";

import {
  fetchCapacidadeCalculada,
  fetchParametrosGerais,
  patchParametrosGerais,
  type ParametrosGeraisPatch,
  type ParametrosGeraisResponse,
} from "@/lib/api/tenant-config-client";



export function useParametrosGerais() {

  const [data, setData] = useState<ParametrosGeraisResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);



  const load = useCallback(async () => {

    setLoading(true);

    try {

      const result = await fetchParametrosGerais();

      setData(result);

      setError(null);

    } catch (err) {

      setError(err instanceof Error ? err.message : "Erro ao carregar parâmetros");

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {

    void load();

  }, [load]);



  const update = useCallback(async (patch: ParametrosGeraisPatch) => {
    const result = await patchParametrosGerais(patch);
    setData(result);
    return result;
  }, []);

  const recalcCapacidade = useCallback(async () => fetchCapacidadeCalculada(), []);

  return { data, loading, error, update, reload: load, recalcCapacidade };
}

