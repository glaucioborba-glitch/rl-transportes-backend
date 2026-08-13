"use client";



import { useEffect, useMemo, useRef, useState } from "react";



export type CepLookupPayload = {

  cep: string;

  logradouro: string;

  bairro: string;

  cidade: string;

  uf: string;

  ibge: string | null;

  cepValido: boolean;

};



type ErrorBody = { field?: string; message?: string };



const CEP_HINT_PARTIAL =
  "CEP não localizado automaticamente, mas o cadastro pode prosseguir.";



function parseErrorMessage(json: unknown, fallback: string): string {

  if (!json || typeof json !== "object") return fallback;

  const m = (json as ErrorBody).message;

  return typeof m === "string" && m.trim() ? m : fallback;

}



/**

 * Dispara busca ao completar 8 dígitos do CEP via `/api/external/cep/:cep` (proxy ViaCEP + IBGE no backend).

 * Não exibe toast — apenas `cepHint` visual. Falhas externas são tratadas como aviso leve.

 */

export function useCepLookup(cepFormatted: string, options?: { debounceMs?: number }) {

  const debounceMs = options?.debounceMs ?? 450;

  const digits = useMemo(() => cepFormatted.replace(/\D/g, ""), [cepFormatted]);



  const [loadingCep, setLoadingCep] = useState(false);

  const [cepHint, setCepHint] = useState<string | null>(null);

  const [data, setData] = useState<CepLookupPayload | null>(null);



  const seq = useRef(0);



  useEffect(() => {

    if (digits.length !== 8) {

      seq.current += 1;

      setLoadingCep(false);

      setCepHint(null);

      setData(null);

      return;

    }



    const ac = new AbortController();

    const mySeq = ++seq.current;



    const t = window.setTimeout(async () => {

      setLoadingCep(true);

      setCepHint(null);

      setData(null);

      try {

        const res = await fetch(`/api/external/cep/${digits}`, {

          signal: ac.signal,

          headers: { Accept: "application/json" },

        });

        const json: unknown = await res.json().catch(() => null);

        if (mySeq !== seq.current) return;



        if (res.status === 400) {

          setData(null);

          setCepHint(parseErrorMessage(json, "CEP deve ter 8 dígitos."));

          return;

        }



        if (!res.ok) {

          setData(null);

          setCepHint(CEP_HINT_PARTIAL);

          return;

        }



        const body = json as Partial<CepLookupPayload> & {

          ok?: boolean;

          cepValido?: boolean;

        };



        const cepValido = body.cepValido === true || body.ok === true;

        const payload: CepLookupPayload = {

          cep: typeof body.cep === "string" ? body.cep : digits,

          logradouro: typeof body.logradouro === "string" ? body.logradouro : "",

          bairro: typeof body.bairro === "string" ? body.bairro : "",

          cidade: typeof body.cidade === "string" ? body.cidade : "",

          uf: typeof body.uf === "string" ? body.uf : "",

          ibge: typeof body.ibge === "string" && body.ibge.trim() ? body.ibge : null,

          cepValido,

        };



        setData(payload);

        if (!cepValido || !payload.ibge) {

          setCepHint(CEP_HINT_PARTIAL);

        } else {

          setCepHint(null);

        }

      } catch (e) {

        if (ac.signal.aborted || mySeq !== seq.current) return;

        setData(null);

        setCepHint(CEP_HINT_PARTIAL);

      } finally {

        if (!ac.signal.aborted && mySeq === seq.current) setLoadingCep(false);

      }

    }, debounceMs);



    return () => {

      ac.abort();

      window.clearTimeout(t);

    };

  }, [digits, debounceMs]);



  const ibgeCode = data?.ibge ?? null;



  return {

    loading: loadingCep,

    loadingCep,

    cepHint,

    /** @deprecated use cepHint */

    error: cepHint,

    data,

    ibgeCode,

    cepValido: data?.cepValido === true && Boolean(data?.ibge),

    cepDigits: digits,

  };

}



export const CEP_SUBMIT_WARNING =
  "Não foi possível validar o CEP automaticamente — continue normalmente.";


